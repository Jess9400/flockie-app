import { Fragment } from "react";

const URL_G = /(https?:\/\/[^\s]+)/gi;

// Render message text with clickable links. Bare URLs become anchors; the rest
// stays plain text. Used by every chat room so links actually work.
export default function MessageText({ content, mine }: { content: string; mine?: boolean }) {
  const parts = content.split(URL_G);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          // Trim trailing punctuation that shouldn't be part of the URL.
          const m = part.match(/^(.*?)([.,!?)]*)$/);
          const url = m ? m[1] : part;
          const tail = m ? m[2] : "";
          return (
            <Fragment key={i}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`break-all underline underline-offset-2 ${mine ? "text-white/90" : "text-flockie-blue"}`}
              >
                {url}
              </a>
              {tail}
            </Fragment>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
