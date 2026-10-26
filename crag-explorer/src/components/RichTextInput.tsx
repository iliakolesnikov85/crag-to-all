import React, { useEffect, useId, useRef } from 'react';
import {
  MdFormatBold,
  MdFormatItalic,
  MdFormatListBulleted,
  MdFormatListNumbered,
  MdLink,
} from 'react-icons/md';
import Button from './Button';
import './RichTextInput.scss';

interface RichTextInputProps {
  label: string;
  value: string;
  onChange: (html: string) => void;
}

function keepEditorSelection(event: React.MouseEvent) {
  event.preventDefault();
}

function linkUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /^(javascript|data):/i.test(trimmed)) return null;
  return trimmed;
}

const RichTextInput: React.FC<RichTextInputProps> = ({ label, value, onChange }) => {
  const editorId = useId().replace(/:/g, '');
  const labelId = `${editorId}-label`;
  const editorRef = useRef<HTMLDivElement>(null);
  const lastHtml = useRef<string | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (value === lastHtml.current) return;
    editor.innerHTML = value;
    lastHtml.current = value;
  }, [value]);

  const publish = () => {
    const html = editorRef.current?.innerHTML ?? '';
    if (html === lastHtml.current) return;
    lastHtml.current = html;
    onChange(html);
  };

  const applyCommand = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    publish();
  };

  const applyLink = () => {
    const entered = window.prompt('Link URL', 'https://');
    if (entered == null) return;
    const url = linkUrl(entered);
    if (!url) {
      console.warn('Rejected description link:', entered);
      return;
    }
    applyCommand('createLink', url);
  };

  return (
    <div className="rich-text">
      <span id={labelId} className="rich-text-label">
        {label}
      </span>
      <div className="rich-text-toolbar" role="toolbar" aria-label={`${label} formatting`}>
        <Button
          type="button"
          iconOnly
          size="sm"
          variant="ghost"
          aria-label="Bold"
          onMouseDown={keepEditorSelection}
          onClick={() => applyCommand('bold')}
        >
          <MdFormatBold />
        </Button>
        <Button
          type="button"
          iconOnly
          size="sm"
          variant="ghost"
          aria-label="Italic"
          onMouseDown={keepEditorSelection}
          onClick={() => applyCommand('italic')}
        >
          <MdFormatItalic />
        </Button>
        <Button
          type="button"
          iconOnly
          size="sm"
          variant="ghost"
          aria-label="Bulleted list"
          onMouseDown={keepEditorSelection}
          onClick={() => applyCommand('insertUnorderedList')}
        >
          <MdFormatListBulleted />
        </Button>
        <Button
          type="button"
          iconOnly
          size="sm"
          variant="ghost"
          aria-label="Numbered list"
          onMouseDown={keepEditorSelection}
          onClick={() => applyCommand('insertOrderedList')}
        >
          <MdFormatListNumbered />
        </Button>
        <Button
          type="button"
          iconOnly
          size="sm"
          variant="ghost"
          aria-label="Link"
          onMouseDown={keepEditorSelection}
          onClick={applyLink}
        >
          <MdLink />
        </Button>
      </div>
      <div
        id={editorId}
        ref={editorRef}
        className="rich-text-editor"
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelId}
        contentEditable
        suppressContentEditableWarning
        onInput={publish}
      />
    </div>
  );
};

export default RichTextInput;
