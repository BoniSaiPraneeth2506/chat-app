// WhatsApp-style inline formatting: *bold*, _italic_, ~strikethrough~, `code`
// and ```code blocks```. Rendered as React nodes so message text is never
// injected as HTML.

const RULES = [
  {
    regex: /```([\s\S]+?)```/,
    render: (children, key) => (
      <pre
        key={key}
        className="my-1 px-2.5 py-2 rounded-lg bg-base-300/60 text-[12px] font-mono whitespace-pre-wrap break-words"
      >
        {children}
      </pre>
    ),
    parseInner: false,
  },
  {
    regex: /`([^`\n]+)`/,
    render: (children, key) => (
      <code key={key} className="px-1 py-0.5 rounded bg-base-300/60 text-[12px] font-mono">
        {children}
      </code>
    ),
    parseInner: false,
  },
  {
    regex: /\*([^*\n]+)\*/,
    render: (children, key) => <strong key={key}>{children}</strong>,
    parseInner: true,
  },
  {
    regex: /_([^_\n]+)_/,
    render: (children, key) => <em key={key}>{children}</em>,
    parseInner: true,
  },
  {
    regex: /~([^~\n]+)~/,
    render: (children, key) => <s key={key}>{children}</s>,
    parseInner: true,
  },
];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlight = (text, query, keyPrefix) => {
  if (!query || !query.trim()) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={`${keyPrefix}-h${i}`} className="bg-yellow-200 text-black px-0.5 rounded font-semibold">
        {part}
      </mark>
    ) : (
      part
    )
  );
};

const parse = (text, query, keyPrefix) => {
  if (!text) return [];

  let earliest = null;
  for (const rule of RULES) {
    const match = rule.regex.exec(text);
    if (match && (!earliest || match.index < earliest.match.index)) {
      earliest = { rule, match };
    }
  }

  if (!earliest) return [highlight(text, query, keyPrefix)];

  const { rule, match } = earliest;
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match[0].length);
  const inner = rule.parseInner
    ? parse(match[1], query, `${keyPrefix}-i`)
    : match[1];

  return [
    ...(before ? [highlight(before, query, `${keyPrefix}-b`)] : []),
    rule.render(inner, `${keyPrefix}-m${match.index}`),
    ...parse(after, query, `${keyPrefix}-a`),
  ];
};

/** Renders message text with markdown shortcuts and optional search highlighting. */
const FormattedText = ({ text, query }) => <>{parse(text || "", query, "f")}</>;

export default FormattedText;
