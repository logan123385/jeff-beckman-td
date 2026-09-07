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

export function stars(n: number, max = 3): HTMLElement {
  const wrap = h('span', { class: 'stars' });
  for (let i = 0; i < max; i++) wrap.append(h('span', { class: i < n ? 'star on' : 'star', text: '★' }));
  return wrap;
}
