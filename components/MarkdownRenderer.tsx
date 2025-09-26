"use client";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { memo } from 'react';
import CopyButton from './CopyButton';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

const MarkdownRenderer = memo(function MarkdownRenderer({ 
  content, 
  className = "", 
  isStreaming = false 
}: MarkdownRendererProps) {
  return (
    <div className={`prose prose-sm max-w-none dark:prose-invert ${className} ${isStreaming ? 'streaming' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // 코드 블록 스타일링
          code(props: React.HTMLProps<HTMLElement>) {
            const { className, children, ...rest } = props;
            const match = /language-(\w+)/.exec(className || '');
            const inline = !match;
            const codeText = String(children).replace(/\n$/, '');
            
            return !inline && match ? (
              <div className="relative group">
                <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto pr-12">
                  <code className={className} {...rest}>
                    {children}
                  </code>
                </pre>
                <CopyButton text={codeText} />
              </div>
            ) : (
              <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm" {...rest}>
                {children}
              </code>
            );
          },
          // 링크 스타일링
          a({ children, href, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline"
                {...props}
              >
                {children}
              </a>
            );
          },
          // 테이블 스타일링
          table({ children, ...props }) {
            return (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600" {...props}>
                  {children}
                </table>
              </div>
            );
          },
          th({ children, ...props }) {
            return (
              <th className="border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-left font-semibold" {...props}>
                {children}
              </th>
            );
          },
          td({ children, ...props }) {
            return (
              <td className="border border-gray-300 dark:border-gray-600 px-3 py-2" {...props}>
                {children}
              </td>
            );
          },
          // 인용구 스타일링
          blockquote({ children, ...props }) {
            return (
              <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400" {...props}>
                {children}
              </blockquote>
            );
          },
          // 리스트 스타일링
          ul({ children, ...props }) {
            return (
              <ul className="list-disc list-inside space-y-1" {...props}>
                {children}
              </ul>
            );
          },
          ol({ children, ...props }) {
            return (
              <ol className="list-decimal list-inside space-y-1" {...props}>
                {children}
              </ol>
            );
          },
          // 제목 스타일링
          h1({ children, ...props }) {
            return (
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4" {...props}>
                {children}
              </h1>
            );
          },
          h2({ children, ...props }) {
            return (
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3" {...props}>
                {children}
              </h2>
            );
          },
          h3({ children, ...props }) {
            return (
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2" {...props}>
                {children}
              </h3>
            );
          },
          // 단락 스타일링
          p({ children, ...props }) {
            return (
              <p className="mb-2 text-gray-900 dark:text-white" {...props}>
                {children}
              </p>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownRenderer;
