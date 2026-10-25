"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Upload, FileText, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);

  const [uploadType, setUploadType] = useState<"text" | "image">("text");
  const [textInput, setTextInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [isClearing, setIsClearing] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleUpload = async () => {
    if (uploadType === "text" && !textInput.trim()) return;
    if (uploadType === "image" && !imageFile) return;

    setIsUploading(true);
    setUploadMessage("");

    try {
      const formData = new FormData();
      if (uploadType === "text") {
        formData.append("text", textInput);
      } else if (imageFile) {
        formData.append("image", imageFile);
      }

      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData, // Auto sets multipart/form-data headers
      });

      const data = await res.json();
      if (res.ok) {
        setUploadMessage(`Success: ${data.message}`);
        setTextInput("");
        setImageFile(null);
      } else {
        setUploadMessage(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setUploadMessage(`Error: ${err.message || "Failed to upload"}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearData = async () => {
    if (!confirm("Are you sure you want to delete all ingested data? This cannot be undone.")) return;

    setIsClearing(true);
    setUploadMessage("");
    try {
      const res = await fetch("/api/clear", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setUploadMessage(`Success: ${data.message}`);
        setMessages([]); // Also clear chat messages locally
      } else {
        setUploadMessage(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setUploadMessage(`Error: ${err.message || "Failed to clear database"}`);
    } finally {
      setIsClearing(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isChatLoading) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, useWebSearch }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to get response");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let done = false;
      let assistantMessage = "";

      // Add a placeholder assistant message
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          assistantMessage += chunk;

          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1].content = assistantMessage;
            return updated;
          });
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, an error occurred." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex pb-10">
      {/* Sidebar for Ingestion */}
      <div className="w-1/3 max-w-sm border-r border-slate-800 bg-slate-900/50 p-6 flex flex-col h-screen sticky top-0">
        <h1 className="text-2xl font-bold mb-6 text-emerald-400">RAG Multimodal</h1>

        <div className="mb-8">
          <p className="text-sm text-slate-400 mb-4">
            Upload images or paste large text to ingest into the vector database.
          </p>

          <div className="flex bg-slate-800 rounded-lg p-1 mb-4">
            <button
              onClick={() => setUploadType("text")}
              className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${uploadType === "text" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                }`}
            >
              <FileText size={16} /> Text
            </button>
            <button
              onClick={() => setUploadType("image")}
              className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${uploadType === "image" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                }`}
            >
              <ImageIcon size={16} /> Image
            </button>
          </div>

          {uploadType === "text" ? (
            <textarea
              className="w-full h-48 bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none mb-4"
              placeholder="Paste large text here to chunk and embed..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
            />
          ) : (
            <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center mb-4 bg-slate-800/50">
              <input
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                className="hidden"
                id="image-upload"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <div className="p-3 bg-slate-800 rounded-full text-emerald-400 mb-2">
                  <Upload size={24} />
                </div>
                <span className="text-sm font-medium text-slate-300">
                  {imageFile ? imageFile.name : "Click to select PNG or JPG"}
                </span>
                <span className="text-xs text-slate-500">
                  Maximum file size: 1MB (Free API limit)
                </span>
              </label>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={
              isUploading ||
              (uploadType === "text" && !textInput.trim()) ||
              (uploadType === "image" && !imageFile)
            }
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {isUploading ? "Processing..." : "Ingest Document"}
          </button>

          <button
            onClick={handleClearData}
            disabled={isClearing || isUploading}
            className="w-full mt-3 bg-red-950/40 hover:bg-red-900/60 border border-red-900/50 disabled:bg-slate-800 disabled:border-slate-800 disabled:text-slate-500 text-red-400 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isClearing ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
            {isClearing ? "Clearing Data..." : "Clear Vector Database"}
          </button>

          {uploadMessage && (
            <div className={`mt-4 p-3 rounded-lg text-sm border ${uploadMessage.includes("Error") ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}>
              {uploadMessage}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-screen max-w-4xl mx-auto px-6">
        <div className="flex-1 overflow-y-auto py-8 no-scrollbar scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500">
              <div className="p-4 bg-slate-800/50 rounded-2xl mb-4 border border-slate-800 shadow-xl">
                <Send size={48} className="text-emerald-500/50" />
              </div>
              <p className="text-lg font-medium text-slate-300">Start a conversation</p>
              <p className="text-sm mt-2 max-w-md text-center">
                Upload some documents or images on the left, then ask questions about them here!
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-5 py-3.5 leading-relaxed shadow-sm ${m.role === "user"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-800 text-slate-200 border border-slate-700/50"
                      }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.role === "assistant" && !m.content && isChatLoading && i === messages.length - 1 && (
                      <div className="flex gap-1 items-center h-5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} className="h-4" />
            </div>
          )}
        </div>

        <div className="pb-6 pt-2 bg-slate-950 sticky bottom-0">
          <div className="flex items-center gap-2 mb-2 px-2 text-sm text-slate-400">
            <input
              type="checkbox"
              id="web-search-toggle"
              checked={useWebSearch}
              onChange={(e) => setUseWebSearch(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500/50 cursor-pointer"
            />
            <label htmlFor="web-search-toggle" className="cursor-pointer select-none">
              Enhance with Web Search (Tavily)
            </label>
          </div>
          <form
            onSubmit={handleSendMessage}
            className="relative flex items-end bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all"
          >
            <textarea
              className="w-full max-h-48 min-h-[56px] bg-transparent text-slate-100 p-3 outline-none resize-none no-scrollbar placeholder:text-slate-500"
              placeholder="Ask anything..."
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = '56px';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 192)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e as unknown as React.FormEvent);
                }
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isChatLoading}
              className="p-3 mb-1 mr-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-emerald-600 self-end flex-shrink-0"
            >
              <Send size={20} />
            </button>
          </form>
          <div className="text-center mt-3 text-xs text-slate-500 font-medium tracking-wide">
            Powered by Groq, Qdrant, HuggingFace & OCR.Space
          </div>
        </div>
      </div>
    </div>
  );
}
