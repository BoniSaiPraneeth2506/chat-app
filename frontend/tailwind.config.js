/* @type {import('tailwindcss').Config} */
import daisyui from 'daisyui'

/**
 * DaisyUI 5 publishes its palette as `--color-primary: oklch(...)` — a complete
 * colour, not the bare channel values Tailwind 3's `/opacity` modifier needs. So
 * `text-base-content/60` and its ~70 siblings compiled to nothing at all: no
 * rule, no warning, roughly 400 places in this app silently rendering without the
 * tint they asked for. That is why so many surfaces looked flat and why several
 * had to be rewritten as hand-written CSS to become visible.
 *
 * Naming the colours here as functions fixes the whole class of them at once.
 * `color-mix` takes a finished colour, so it works with exactly what DaisyUI
 * emits.
 *
 * Only the modifier form is rewritten. Tailwind hands this function a CSS
 * variable (`var(--tw-bg-opacity, 1)`) rather than a number when no modifier was
 * written, and those utilities already work — so they keep their plain `var()`
 * value untouched. Nothing that renders today can change or break; the only
 * difference is that `/NN` now produces a rule. On a browser too old for
 * `color-mix` those utilities stay inert, which is precisely where they are now.
 */
const withOpacity = (variable) => ({ opacityValue }) => {
  if (opacityValue === undefined || String(opacityValue).startsWith('var(')) {
    return `var(${variable})`;
  }
  return `color-mix(in oklch, var(${variable}) calc(${opacityValue} * 100%), transparent)`;
};

const semantic = [
  'primary', 'primary-content',
  'secondary', 'secondary-content',
  'accent', 'accent-content',
  'neutral', 'neutral-content',
  'base-100', 'base-200', 'base-300', 'base-content',
  'info', 'info-content',
  'success', 'success-content',
  'warning', 'warning-content',
  'error', 'error-content',
];

const colors = Object.fromEntries(
  semantic.map((name) => [name, withOpacity(`--color-${name}`)])
);

export default {
   content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors,
    },
  },
  plugins: [daisyui],
}
