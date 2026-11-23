import React from 'react';
import { parseMarkdown } from '../lib/mdParse';

const inline = (nodes) => nodes.map((n, i) => {
  if (n.t === 'text') return n.v;
  if (n.t === 'code') return <code key={i}>{n.v}</code>;
  if (n.t === 'b') return <strong key={i}>{inline(n.c)}</strong>;
  if (n.t === 'i') return <em key={i}>{inline(n.c)}</em>;
  if (n.t === 'a') return <a key={i} href={n.href} target="_blank" rel="noopener noreferrer">{inline(n.c)}</a>;
  return null;
});

const block = (b, i) => {
  if (b.t === 'h') return React.createElement(`h${Math.min(b.n + 1, 6)}`, { key: i }, inline(b.c));
  if (b.t === 'p') return <p key={i}>{inline(b.c)}</p>;
  if (b.t === 'hr') return <hr key={i} />;
  if (b.t === 'code') return <pre key={i}><code>{b.v}</code></pre>;
  if (b.t === 'quote') return <blockquote key={i}>{b.c.map(block)}</blockquote>;
  if (b.t === 'list') {
    const items = b.items.map((it, j) => <li key={j}>{inline(it.c)}{it.sub.length > 0 && <ul>{it.sub.map((s, k) => <li key={k}>{inline(s)}</li>)}</ul>}</li>);
    return b.ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>;
  }
  if (b.t === 'table') {
    return (
      <div key={i} className="md-tablewrap">
        <table>
          <thead><tr>{b.head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
          <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{inline(c)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  return null;
};

// A markdown text shown as a document (reader view). Plain React elements: no raw HTML.
export function MarkdownView({ text }) {
  return <div className="md-reader">{parseMarkdown(text).map(block)}</div>;
}
