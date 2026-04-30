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
    `p-2 rounded-lg transition-all ${
      active
        ? "bg-blue-100 text-blue-600"
        : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
    }`;

  return (
    <div className="rounded-2xl border bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gradient-to-r from-gray-50 to-gray-100">
        {/* Left Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={btnClass(editor.isActive("bold"))}
          >
            <Bold size={16} />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={btnClass(editor.isActive("italic"))}
          >
            <Italic size={16} />
          </button>

          <div className="w-px h-5 bg-gray-300 mx-2" />

          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={btnClass(editor.isActive("bulletList"))}
          >
            <List size={16} />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={btnClass(editor.isActive("orderedList"))}
          >
            <ListOrdered size={16} />
          </button>
        </div>

        {/* Right Side (AI Badge) */}
        {/* <div className="flex items-center gap-1 text-xs font-semibold text-amber-500">
          <Sparkles size={14} />
          AI Assist
        </div> */}
      </div>

      {/* Editor Area */}
      <EditorContent
        editor={editor}
        className="tiptap-content px-5 py-4 min-h-[220px] focus:outline-none"
      />
    </div>
  );
}
