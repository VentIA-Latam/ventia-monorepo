import { Fragment, type ReactNode } from "react";

// Hoisted at module scope (js-hoist-regexp).
// Boundary rule: marker can't sit between word chars (no false positives in "S/.60_00" or "2*3").
// Inner content: at least 1 non-marker char, no newlines, no leading/trailing whitespace.
const MONO_RE = /```([\s\S]+?)```/;
const BOLD_RE = /(?<![*\w])\*([^*\n\s](?:[^*\n]*[^*\n\s])?)\*(?![*\w])/;
const ITALIC_RE = /(?<![_\w])_([^_\n\s](?:[^_\n]*[^_\n\s])?)_(?![_\w])/;
const STRIKE_RE = /(?<![~\w])~([^~\n\s](?:[^~\n]*[^~\n\s])?)~(?![~\w])/;

type Marker = {
  re: RegExp;
  render: (children: ReactNode, key: string) => ReactNode;
  recurse: boolean;
};

const MARKERS: Marker[] = [
  {
    re: MONO_RE,
    render: (children, key) => (
      <code
        key={key}
        className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.9em]"
      >
        {children}
      </code>
    ),
    recurse: false,
  },
  {
    re: BOLD_RE,
    render: (children, key) => <strong key={key}>{children}</strong>,
    recurse: true,
  },
  {
    re: ITALIC_RE,
    render: (children, key) => <em key={key}>{children}</em>,
    recurse: true,
  },
  {
    re: STRIKE_RE,
    render: (children, key) => <s key={key}>{children}</s>,
    recurse: true,
  },
];

const MAX_DEPTH = 6;

export function formatWhatsAppText(text: string | null | undefined): ReactNode {
  if (!text) return text ?? null;
  return parse(text, 0, "0");
}

function parse(text: string, depth: number, keyPath: string): ReactNode {
  if (depth >= MAX_DEPTH || !text) return text;

  // Find the earliest-starting marker so nested/adjacent formatting is honored in source order.
  let best: { marker: Marker; match: RegExpExecArray } | null = null;
  for (const marker of MARKERS) {
    const match = marker.re.exec(text);
    if (!match) continue;
    if (!best || match.index < best.match.index) {
      best = { marker, match };
    }
  }

  if (!best) return text;

  const before = text.slice(0, best.match.index);
  const inner = best.match[1];
  const after = text.slice(best.match.index + best.match[0].length);
  const childKey = `${keyPath}-${best.match.index}`;
  const children = best.marker.recurse ? parse(inner, depth + 1, `${childKey}i`) : inner;

  return (
    <Fragment key={keyPath}>
      {before ? parse(before, depth + 1, `${childKey}b`) : null}
      {best.marker.render(children, childKey)}
      {after ? parse(after, depth + 1, `${childKey}a`) : null}
    </Fragment>
  );
}
