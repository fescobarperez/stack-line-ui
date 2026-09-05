// Stackline — Botón (Material Design 3)
//
// Único punto de entrada para los botones de la app. Antes convivían dos juegos
// de clases para las mismas cinco variantes (.btn.accent vs .btn-filled, .btn.ghost
// vs .btn-text…) y varias de ellas eran reglas parciales que sin `.btn` dejaban el
// botón sin alto ni padding. Aquí la clase la arma el componente, no el llamador.
//
//   <Button variant="accent" icon="plus" onClick={crear}>Agregar cliente</Button>
//   <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
//   <Button variant="error" icon="trash" onClick={borrar}>Eliminar</Button>
//   <Button size="sm" iconOnly icon="edit" title="Editar" onClick={editar} />
//
// El botón de "Cancelar" de un diálogo NO tiene variante propia: es `ghost`.
// Darle un nombre semántico aparte reintroduciría el problema de dos nombres
// para el mismo botón, que es justo lo que este componente vino a cerrar.
import React from 'react';
import Icon from './Icon.jsx';

const VARIANT = {
  outlined: '',             // por defecto — el .btn base ya es outlined
  accent:   'accent',       // filled, acción primaria
  tonal:    'tonal',        // secondary-container
  ghost:    'ghost',        // text
  danger:   'danger',       // text en color error
  error:    'filled-error', // destructivo relleno
  'danger-outline': 'danger-outline', // outlined en color error
  elevated: 'elevated',
};
const SIZE      = { sm: 'sm', md: '', lg: 'lg' };   // 32 · 40 · 48 px
const ICON_SIZE = { sm: 16, md: 18, lg: 20 };

export default function Button({
  variant = 'outlined',
  size = 'md',
  icon = null,        // icono delante del texto
  iconRight = null,   // icono detrás
  iconOnly = false,   // sin texto: padding reducido
  full = false,       // ocupa el ancho del contenedor
  className = '',     // solo para layout puntual, nunca para variantes
  children,
  ...rest             // onClick, disabled, type, title, style, aria-*, key…
}) {
  const cls = ['btn', SIZE[size] || '', VARIANT[variant] || '',
               iconOnly && 'icon', full && 'full', className];
  const isz = ICON_SIZE[size] || 18;
  return (
    <button className={cls.filter(Boolean).join(' ')} {...rest}>
      {icon && <Icon name={icon} size={isz} />}
      {children}
      {iconRight && <Icon name={iconRight} size={isz} />}
    </button>
  );
}

export { Button };
