import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/supplierIngestion.js', () => ({
  createSupplierWebsite: vi.fn(),
}));

import { createSupplierWebsite } from '../api/supplierIngestion.js';
import SupplierWebsiteInlineForm, { isValidHttpWebsiteUrl, suggestedWebsiteName } from './SupplierWebsiteInlineForm.jsx';

describe('SupplierWebsiteInlineForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('suggests a name and assigns the website to the selected supplier', async () => {
    const created = { id: 17, supplierId: 4, name: 'example.com', baseUrl: 'https://www.example.com/catalog/' };
    createSupplierWebsite.mockResolvedValue(created);
    const onCreated = vi.fn();

    render(<SupplierWebsiteInlineForm supplierId="4" onCreated={onCreated} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('URL base *'), {
      target: { value: 'https://www.example.com/catalog/' },
    });

    expect(screen.getByLabelText('Nombre del sitio')).toHaveValue('example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Asignar página' }));

    await waitFor(() => expect(createSupplierWebsite).toHaveBeenCalledWith({
      supplierId: 4,
      name: 'example.com',
      baseUrl: 'https://www.example.com/catalog/',
      websiteType: 'catalog',
      status: 'active',
      crawlEnabled: true,
    }));
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it('accepts only complete HTTP or HTTPS URLs', () => {
    expect(suggestedWebsiteName('https://www.example.com/catalog')).toBe('example.com');
    expect(isValidHttpWebsiteUrl('http://example.com')).toBe(true);
    expect(isValidHttpWebsiteUrl('ftp://example.com')).toBe(false);
    expect(isValidHttpWebsiteUrl('example.com')).toBe(false);
  });
});
