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
        placeholder: "Write your campaign message...",
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
    `rounded-lg p-2 transition-all ${
      active
        ? "bg-[#13538A]/10 text-[#13538A]"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    }`;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-[#13538A] focus-within:ring-2 focus-within:ring-[#13538A]/20 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={btnClass(editor.isActive("bold"))}
          >
            <Bold size={16} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={btnClass(editor.isActive("italic"))}
          >
            <Italic size={16} />
          </button>

          <div className="mx-2 h-5 w-px bg-slate-200 dark:bg-slate-700" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={btnClass(editor.isActive("bulletList"))}
          >
            <List size={16} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={btnClass(editor.isActive("orderedList"))}
          >
            <ListOrdered size={16} />
          </button>
        </div>
      </div>

      <EditorContent
        editor={editor}
        className="tiptap-content min-h-[220px] px-5 py-4 focus:outline-none"
      />
    </div>
  );
}
