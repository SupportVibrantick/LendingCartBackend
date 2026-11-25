import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

export default function RichEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write your campaign message…",
        showOnlyWhenEditable: true,
        emptyEditorClass: "is-empty",
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `rounded-lg p-2 transition ${
      active
        ? "bg-[#4C78F5]/10 text-[#4C78F5]"
        : "text-text-secondary hover:bg-surface hover:text-text-primary"
    }`;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white transition focus-within:border-[#4C78F5]/50 focus-within:ring-2 focus-within:ring-[#4C78F5]/15 dark:border-slate-700 dark:bg-slate-950">
      <div className="flex items-center border-b border-border bg-slate-50/70 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={btnClass(editor.isActive("bold"))}
            aria-label="Bold"
          >
            <Bold size={15} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={btnClass(editor.isActive("italic"))}
            aria-label="Italic"
          >
            <Italic size={15} />
          </button>

          <div className="mx-1.5 h-4 w-px bg-border dark:bg-slate-700" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={btnClass(editor.isActive("bulletList"))}
            aria-label="Bullet list"
          >
            <List size={15} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={btnClass(editor.isActive("orderedList"))}
            aria-label="Numbered list"
          >
            <ListOrdered size={15} />
          </button>
        </div>
      </div>

      <EditorContent
        editor={editor}
        className="tiptap-content min-h-[200px] px-4 py-3.5 text-sm leading-relaxed focus:outline-none"
      />
    </div>
  );
}
