import { describe, expect, it } from 'vitest';
import { conditionValid, moveCondition } from './QuoteConditionsEditor.jsx';

describe('condiciones comerciales', () => {
  it('pide título y texto', () => {
    expect(conditionValid({ title: 'Garantía', body: '1 año' })).toBe(true);
    expect(conditionValid({ title: ' ', body: '1 año' })).toBe(false);
    expect(conditionValid({ title: 'Garantía', body: '' })).toBe(false);
  });

  it('reordena sin salirse de la lista', () => {
    const rows = ['a', 'b', 'c'];
    expect(moveCondition(rows, 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveCondition(rows, 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveCondition(rows, 0, -1)).toBe(rows);
  });
});
