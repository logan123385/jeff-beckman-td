type Child = Node | string | null | undefined | false;

export interface Props {
  class?: string;
  text?: string;
  html?: string;
  title?: string;
  onClick?: (ev: MouseEvent) => void;
  onMouseEnter?: (ev: MouseEvent) => void;
  onMouseLeave?: (ev: MouseEvent) => void;
  disabled?: boolean;
  attrs?: Record<string, string>;
  style?: Partial<CSSStyleDeclaration>;
}

/** Tiny element builder so screens stay readable without a framework. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  if (props.html !== undefined) el.innerHTML = props.html;
  if (props.title) el.title = props.title;
  if (props.onClick) el.addEventListener('click', props.onClick as EventListener);
  if (props.onMouseEnter) el.addEventListener('mouseenter', props.onMouseEnter as EventListener);
  if (props.onMouseLeave) el.addEventListener('mouseleave', props.onMouseLeave as EventListener);
  if (props.disabled && 'disabled' in el) (el as HTMLButtonElement).disabled = true;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) el.setAttribute(k, v);
  if (props.style) Object.assign(el.style, props.style);
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** A 1½-inch PEX press elbow is the campaign rating and perk currency. */
export function ninetyIcon(size = 30): HTMLElement {
  return h('span', { class: 'ninety-icon', title: "1½-inch PureFlow PEX press 90", style: { width: `${size}px`, height: `${size}px` }, html: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 7v15c0 8 5 13 13 13h15" fill="none" stroke="#10171b" stroke-width="15"/><path d="M10 9v13c0 9 6 16 17 16h12" fill="none" stroke="#4b555a" stroke-width="3"/><path d="M20 19v4c0 3 2 5 6 5h4" fill="none" stroke="#667176" stroke-width="1.5"/><g stroke="#424c51" stroke-width="1"><path d="M4 3h18v14H4z" fill="#c6d1d6"/><path d="M31 26h14v18H31z" fill="#c6d1d6"/></g><path d="M6 4v12M10 4v12M33 28h11M33 32h11" stroke="#f7fbfc" stroke-width="2"/><path d="M18 4v12M33 40h11" stroke="#89999f" stroke-width="3"/><path d="M4 17h18M30 26v18" stroke="#dac74b" stroke-width="3"/><ellipse cx="13" cy="3" rx="9" ry="2.5" fill="#526068"/><ellipse cx="13" cy="3" rx="6.5" ry="1.4" fill="#101719"/><ellipse cx="45" cy="35" rx="2.4" ry="9" fill="#53636b"/><ellipse cx="45" cy="35" rx="1.2" ry="6.6" fill="#131b1f"/></svg>` });
}
export function stars(n: number, max = 3): HTMLElement {
  const wrap = h('span', { class: 'stars nineties', attrs: { 'aria-label': `${n} of ${max} 90’s` } });
  for (let i = 0; i < max; i++) wrap.append(h('span', { class: i < n ? 'star on' : 'star' }, ninetyIcon()));
  return wrap;
}
