"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

/** Safe by default: react-markdown never renders raw HTML from model output (XSS). */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-tutor">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">{children}</a> }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
