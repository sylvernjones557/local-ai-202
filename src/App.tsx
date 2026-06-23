/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  MessageSquare, 
  Plus, 
  Trash2, 
  Send, 
  Cpu, 
  Settings2, 
  Compass, 
  Copy, 
  Check, 
  BookOpen, 
  Terminal, 
  ArrowRight, 
  ChevronRight,
  User,
  Activity,
  X
} from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

interface Thread {
  id: string;
  title: string;
  systemInstruction?: string;
  model: string;
  messages: Message[];
  createdAt: number;
}

const PRESET_PERSONAS = [
  {
    name: 'Tech Explainer',
    role: 'Socratic Tutor',
    emoji: '🎓',
    instruction: 'You are an elite, patient technical tutor. Do not just present solutions; explain complex subjects using intuitive real-world analogies. Engage with simple concepts first, then escalate.'
  },
  {
    name: 'Creative Writer',
    role: 'Ghost Writer',
    emoji: '🖋️',
    instruction: 'You are a professional novelist and creative consultant. Write with rich imagery, subtle metaphors, and high-vocabulary prose. Avoid repetitive adjectives or cliché phrases.'
  },
  {
    name: 'Senior Developer',
    role: 'Refactoring Expert',
    emoji: '💻',
    instruction: 'You are a veteran software architect. Provide clean, highly-optimized, secure TypeScript/Node code that compiles perfectly. Explain code structures using precise modern engineering terms.'
  },
  {
    name: 'UX designer',
    role: 'User Advocate',
    emoji: '✨',
    instruction: 'You are an expert product and user-experience designer. Critique copy, layouts, and feature sets purely from the lens of friction-free workflows, accessibility, and high visual hierarchy.'
  }
];

const PROMPT_TEMPLATES = [
  {
    title: 'Explain Quantum Computing',
    desc: 'Break deep elements down for an interested 10-year-old',
    prompt: 'Explain how quantum computing and qubits work using a simple coin spin analogy, then tell me why that is faster than normal chips.'
  },
  {
    title: 'Code Custom Hooks',
    desc: 'Generate a stateful react hook for local storage',
    prompt: 'Write a TypeScript custom React hook called useLocalStorage with clean error handling, strict type safety, and automatic sync across tabs.'
  },
  {
    title: 'Email Copy Touch-up',
    desc: 'Draft critical negotiation responses professionally',
    prompt: 'Re-write this email draft to make it sound incredibly professional, polite, firm, and focused on shared value: "Hey, we are not happy with the current price quote. Can you go down 15%?"'
  },
  {
    title: 'Analyze UX Patterns',
    desc: 'Evaluate custom infinite scroll designs',
    prompt: 'Analyze the UX implications of infinite-scroll lists versus explicit pagination on interactive mobile dashboards. List tradeoffs and a specific solution.'
  }
];

export default function App() {
  // Persistence-backed states
  const [threads, setThreads] = useState<Thread[]>(() => {
    const saved = localStorage.getItem('ai_hub_threads');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed restructing local threads', e);
      }
    }
    // Return initial array
    return [
      {
        id: 'thread-default',
        title: 'Initial Sandbox Task',
        systemInstruction: PRESET_PERSONAS[0].instruction,
        model: 'gemini-3.5-flash',
        messages: [],
        createdAt: Date.now()
      }
    ];
  });

  const [activeThreadId, setActiveThreadId] = useState<string>(() => {
    const savedId = localStorage.getItem('ai_hub_active_id');
    return savedId || 'thread-default';
  });

  // Current customization states in focus
  const [customSystemInstruction, setCustomSystemInstruction] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash');
  const [inputText, setInputText] = useState('');
  
  // App-level transient states
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync threads to localStorage
  useEffect(() => {
    localStorage.setItem('ai_hub_threads', JSON.stringify(threads));
  }, [threads]);

  // Sync active id to localStorage
  useEffect(() => {
    localStorage.setItem('ai_hub_active_id', activeThreadId);
    
    // Sync panel settings when thread changes
    const curThread = threads.find(t => t.id === activeThreadId);
    if (curThread) {
      setCustomSystemInstruction(curThread.systemInstruction || '');
      setSelectedModel(curThread.model);
    }
  }, [activeThreadId]);

  // Auto-scroll to message end
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [threads, isLoading]);

  const activeThread = threads.find(t => t.id === activeThreadId) || threads[0] || {
    id: activeThreadId,
    title: 'Initial Sandbox Task',
    systemInstruction: '',
    model: 'gemini-3.5-flash',
    messages: []
  };

  // Helper to append a message to current thread
  const addMessageToActiveThread = (message: Message) => {
    setThreads(prev => prev.map(t => {
      if (t.id === activeThreadId) {
        const updatedMsgs = [...t.messages, message];
        // Generate title if original was empty/default name
        let title = t.title;
        if (t.messages.length === 0 && message.role === 'user') {
          title = message.parts[0].text.substring(0, 30);
          if (message.parts[0].text.length > 30) title += '...';
        }
        return {
          ...t,
          messages: updatedMsgs,
          title
        };
      }
      return t;
    }));
  };

  // Switch Thread
  const selectThread = (id: string) => {
    setActiveThreadId(id);
    setApiError(null);
  };

  // Create New Thread
  const createNewThread = (presetInstruction?: string) => {
    const newId = `thread-${Date.now()}`;
    const newThread: Thread = {
      id: newId,
      title: 'Blank Conversation',
      systemInstruction: presetInstruction !== undefined ? presetInstruction : PRESET_PERSONAS[0].instruction,
      model: 'gemini-3.5-flash',
      messages: [],
      createdAt: Date.now()
    };
    setThreads(prev => [newThread, ...prev]);
    setActiveThreadId(newId);
    setApiError(null);
  };

  // Delete Thread
  const deleteThread = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (threads.length === 1) {
      // Just clear current thread if it's the last one left
      setThreads([{
        id: 'thread-default',
        title: 'Initial Sandbox Task',
        systemInstruction: PRESET_PERSONAS[0].instruction,
        model: 'gemini-3.5-flash',
        messages: [],
        createdAt: Date.now()
      }]);
      setActiveThreadId('thread-default');
      return;
    }

    const index = threads.findIndex(t => t.id === id);
    const updated = threads.filter(t => t.id !== id);
    setThreads(updated);

    if (activeThreadId === id) {
      const fallbackIndex = index === 0 ? 0 : index - 1;
      setActiveThreadId(updated[fallbackIndex].id);
    }
  };

  // Apply customization parameters dynamically to active thread
  const updateActiveThreadConfig = (fields: Partial<Pick<Thread, 'systemInstruction' | 'model'>>) => {
    setThreads(prev => prev.map(t => {
      if (t.id === activeThreadId) {
        return { ...t, ...fields };
      }
      return t;
    }));
  };

  // Submit trigger to API route
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    setInputText('');
    setApiError(null);

    // 1. Append user query locally
    const userMessage: Message = {
      role: 'user',
      parts: [{ text: textToSend }]
    };
    addMessageToActiveThread(userMessage);
    setIsLoading(true);

    try {
      // Retrieve modern complete sequence for conversation
      // Excluding full content to keep API memory lightweight
      const payloadMessages = activeThread.messages ? [...activeThread.messages] : [];

      const endpoint = '/api/chat';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: payloadMessages,
          systemInstruction: customSystemInstruction || undefined,
          model: selectedModel
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || `Server returned error status ${response.status}`);
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        role: 'model',
        parts: [{ text: data.text || 'No output produced by the assistant.' }]
      };
      
      addMessageToActiveThread(assistantMessage);
    } catch (err: any) {
      console.error(err);
      setApiError(err?.message || 'A network error occurred while communicating with the server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Action triggers
  const handlePresetTrigger = (presetPrompt: string) => {
    setInputText(presetPrompt);
    handleSendMessage(presetPrompt);
  };

  // Action to Copy code block
  const triggerCopyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => {
      setCopiedCodeId(null);
    }, 2000);
  };

  // Custom parser to split prompt text from markdown code blocks
  const parseMessageContent = (text: string) => {
    if (!text) return [];
    
    // Split block content by triple backticks
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
    
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Prior plain text segment
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.slice(lastIndex, match.index)
        });
      }

      parts.push({
        type: 'code',
        language: match[1] || 'plaintext',
        content: match[2]?.trim() || ''
      });

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex)
      });
    }

    return parts;
  };

  return (
    <div id="app_root" className="flex h-screen w-full bg-zinc-50 text-zinc-900 font-sans antialiased overflow-hidden">
      
      {/* SIDEBAR MODULE (Desktop Panel) */}
      <aside id="desktop_sidebar" className="hidden md:flex flex-col w-80 bg-white border-r border-zinc-200">
        
        {/* Header Branding */}
        <div id="sidebar_header" className="p-5 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-zinc-900 rounded-lg text-white">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-semibold text-zinc-900 leading-none">AI Studio Hub</h1>
              <span className="text-xs text-zinc-400 font-mono tracking-tight">Active API Sandbox</span>
            </div>
          </div>
        </div>

        {/* Action Button: Create Thread */}
        <div className="p-4">
          <button
            id="new_thread_button_desktop"
            onClick={() => createNewThread()}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-2.5 px-4 rounded-lg transition-all text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Workspace
          </button>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1">
          <div className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
            Workspaces
          </div>
          {threads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            return (
              <div
                id={`thread_item_${thread.id}`}
                key={thread.id}
                onClick={() => selectThread(thread.id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all ${
                  isActive 
                    ? 'bg-zinc-100 text-zinc-900 font-medium' 
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-zinc-900' : 'text-zinc-400'}`} />
                  <span className="truncate">{thread.title}</span>
                </div>
                <button
                  id={`delete_thread_btn_${thread.id}`}
                  onClick={(e) => deleteThread(thread.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 rounded hover:bg-zinc-200 transition-all"
                  title="Delete Workspace"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Live System Indicator */}
        <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Connection Secure (Server Proxy)</span>
          </div>
          <div className="text-[10px] text-zinc-400 font-mono">
            Key: Attached &amp; Managed
          </div>
        </div>
      </aside>

      {/* MAIN CONSOLE APP STAGE */}
      <main id="main_viewport" className="flex-1 flex flex-col min-w-0 bg-zinc-50 h-full relative">
        
        {/* Top bar header */}
        <header id="stage_header" className="h-16 border-b border-zinc-200/80 bg-white px-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Unified Sandbox Settings Trigger */}
            <button
              id="sandbox_settings_toggle"
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-lg flex items-center gap-2 hover:text-zinc-900 transition-colors"
              title="Open Sandbox Settings"
            >
              <Settings2 className="w-5 h-5" />
              <span className="hidden sm:inline text-xs font-semibold uppercase tracking-wider font-mono">Settings</span>
            </button>
            <div className="min-w-0">
              <h2 className="font-semibold text-zinc-900 text-base leading-snug truncate">
                {activeThread.title}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 leading-none">
                <span className="font-mono bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                  {selectedModel}
                </span>
                <span>•</span>
                <span className="truncate">
                  {customSystemInstruction ? 'Persona Active' : 'No instruction configured'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Quick Clear & Controls */}
          <div className="flex items-center gap-2">
            <button
              id="header_add_thread_mobile"
              onClick={() => createNewThread()}
              className="md:hidden p-2 text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg flex items-center justify-center"
              title="New thread"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              id="clean_workspace_btn"
              onClick={() => {
                setThreads(prev => prev.map(t => {
                  if (t.id === activeThreadId) {
                    return { ...t, messages: [] };
                  }
                  return t;
                }));
                setApiError(null);
              }}
              className="text-xs px-2.5 py-1.5 text-zinc-500 hover:text-zinc-900 font-medium rounded-lg hover:bg-zinc-100 transition-all border border-zinc-200"
            >
              Clear Messages
            </button>
          </div>
        </header>

        {/* WORKSPACE MIDDLE BODY - SCROLLABLE CHAT STAGE + SIDE PARAMETERS BAR */}
        <div id="stage_core_body" className="flex-1 flex overflow-hidden relative">
          
          {/* Chat scrolling viewport */}
          <div id="chat_scroll_container" className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50">
            <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6">
              
              {/* Show instructions & quick triggers if thread is brand new & empty */}
              {activeThread.messages.length === 0 && (
                <div id="empty_stage_welcome" className="max-w-2xl mx-auto space-y-8 pt-4 md:pt-10">
                  <div className="space-y-3 text-center">
                    <div className="inline-flex p-3 bg-white rounded-2xl shadow-sm border border-zinc-200/60 mb-2">
                      <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-zinc-900">
                      Welcome to your AI Assistant Workspace
                    </h3>
                    <p className="text-zinc-500 text-sm max-w-lg mx-auto">
                      Select a role template, adjust parameters, or pick a rapid prompt concept below to kickstart your creative pipeline.
                    </p>
                  </div>

                  {/* PRESET INTENTS GRID */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
                      1. Pick a Role Persona Preset
                    </h4>
                    <div id="preset_personas_grid" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {PRESET_PERSONAS.map((person, idx) => (
                        <div
                          id={`persona_preset_${idx}`}
                          key={idx}
                          role="button"
                          onClick={() => {
                            setCustomSystemInstruction(person.instruction);
                            updateActiveThreadConfig({ systemInstruction: person.instruction });
                          }}
                          className={`p-4 rounded-xl text-left border bg-white cursor-pointer transition-all hover:border-zinc-300 hover:shadow-sm ${
                            customSystemInstruction === person.instruction 
                              ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/10' 
                              : 'border-zinc-200/80'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-lg">{person.emoji}</span>
                            <span className="font-semibold text-sm text-zinc-900">{person.name}</span>
                          </div>
                          <span className="text-xs text-zinc-400 block line-clamp-1">{person.role}</span>
                          <p className="text-xs text-zinc-500 mt-2 line-clamp-2 leading-relaxed">
                            {person.instruction}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PROMPT CONCEPTS */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
                      2. Choose a Prompt Template
                    </h4>
                    <div id="prompt_templates_grid" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {PROMPT_TEMPLATES.map((tmpl, idx) => (
                        <button
                          id={`prompt_tmpl_${idx}`}
                          key={idx}
                          onClick={() => handlePresetTrigger(tmpl.prompt)}
                          className="p-4 rounded-xl text-left bg-white border border-zinc-200/80 hover:border-zinc-300 transition-all group flex flex-col justify-between hover:shadow-sm"
                        >
                          <div>
                            <span className="font-semibold text-sm text-zinc-900 block group-hover:text-indigo-600 transition-colors">
                              {tmpl.title}
                            </span>
                            <p className="text-xs text-zinc-500 mt-1 leading-normal">
                              {tmpl.desc}
                            </p>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 font-medium w-full">
                            <span className="font-mono text-[10px]">Instant Action</span>
                            <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* MESSAGES LISTING */}
              {activeThread.messages.length > 0 && (
                <div id="message_history_stage" className="max-w-3xl mx-auto space-y-6">
                  {activeThread.messages.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div
                        id={`msg_bubble_${idx}`}
                        key={idx}
                        className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        {/* Profile icon */}
                        {!isUser && (
                          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                            <Sparkles className="w-4 h-4 text-indigo-400" />
                          </div>
                        )}

                        {/* Content text */}
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed text-sm ${
                          isUser 
                            ? 'bg-zinc-900 text-white shadow-sm' 
                            : 'bg-white border border-zinc-200/80 text-zinc-800 shadow-sm'
                        }`}>
                          
                          {/* Parse and Render markdown style cleanly */}
                          {parseMessageContent(msg.parts[0].text).map((part, pIdx) => {
                            if (part.type === 'code') {
                              return (
                                <div key={pIdx} className="my-3 rounded-lg overflow-hidden border border-zinc-700/20 bg-zinc-950 font-mono text-zinc-100 text-xs shadow-inner">
                                  {/* Code Header Bar */}
                                  <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-2 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                                    <span>{part.language || 'code'}</span>
                                    <button
                                      id={`copy_btn_${idx}_${pIdx}`}
                                      onClick={() => triggerCopyCode(part.content, `${idx}-${pIdx}`)}
                                      className="flex items-center gap-1.5 hover:text-white transition-colors py-0.5 px-2 rounded hover:bg-zinc-800"
                                    >
                                      {copiedCodeId === `${idx}-${pIdx}` ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                                          <span className="text-emerald-400">Copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5" />
                                          <span>Copy</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <pre className="p-4 overflow-x-auto whitespace-pre leading-relaxed font-mono">
                                    <code>{part.content}</code>
                                  </pre>
                                </div>
                              );
                            } else {
                              // Plain text parser segment for rendering basic line-breaks
                              return (
                                <p key={pIdx} className="whitespace-pre-line leading-relaxed break-words py-1">
                                  {part.content}
                                </p>
                              );
                            }
                          })}
                        </div>

                        {/* User Profile visual */}
                        {isUser && (
                          <div className="w-8 h-8 rounded-lg bg-zinc-200 text-zinc-700 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5 border border-zinc-300">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Dynamic thinking loading state indicator */}
                  {isLoading && (
                    <div id="ai_thinking_bubble" className="flex gap-3.5 justify-start">
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
                      </div>
                      <div className="bg-white border border-zinc-200/80 rounded-2xl px-5 py-3.5 shadow-sm text-sm text-zinc-500 flex items-center gap-2">
                        <span className="font-medium font-mono text-xs">AI Studio Hub is generating content</span>
                        <span className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      </div>
                    </div>
                  )}

                  {/* API Errors Output */}
                  {apiError && (
                    <div id="api_error_panel" className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm max-w-2xl mx-auto space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <span>An error occurred</span>
                      </div>
                      <p className="text-xs leading-normal font-mono bg-white p-2.5 rounded border border-red-100/60 break-all text-red-600">
                        {apiError}
                      </p>
                      <p className="text-[11px] text-red-500 pt-1">
                        Tip: Make sure you have configured your model secrets correctly in the settings.
                      </p>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}

            </div>

            {/* MESSAGE INPUT DOCK INPUT */}
            <div id="chat_input_dock" className="p-4 border-t border-zinc-200/80 bg-white flex-shrink-0">
              <div className="max-w-3xl mx-auto">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!inputText.trim()) return;
                    handleSendMessage(inputText);
                  }}
                  className="relative flex items-center bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900 rounded-xl transition-all"
                >
                  <input
                    id="user_prompt_input"
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      activeThread.messages.length === 0 
                        ? "Select a template above, or ask anything to start..." 
                        : "Ask next message..."
                    }
                    className="w-full bg-transparent px-4 py-3.5 text-zinc-900 text-sm focus:outline-none placeholder-zinc-400/80 pr-12"
                    disabled={isLoading}
                  />
                  <div className="absolute right-2.5 flex items-center">
                    <button
                      id="submit_prompt_action"
                      type="submit"
                      disabled={!inputText.trim() || isLoading}
                      className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                        inputText.trim() && !isLoading
                          ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                          : 'bg-zinc-100 text-zinc-300 cursor-not-allowed'
                      }`}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
                <div id="console_subtext" className="mt-2 flex items-center justify-between text-[11px] text-zinc-400 px-1 font-mono">
                  <span>Press enter to send</span>
                  <span className="flex items-center gap-1">
                    <span>Active instructions:</span>
                    <span className="text-zinc-600 font-medium max-w-[120px] truncate">
                      {customSystemInstruction ? 'Custom Persona' : 'None'}
                    </span>
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* SLIDE-OUT UNIFIED SETTINGS DRAWER */}
        {showSettings && (
          <div id="settings_drawer_backdrop" className="fixed inset-0 z-50 flex justify-end bg-zinc-950/40 backdrop-blur-[2px] transition-opacity" onClick={() => setShowSettings(false)}>
            <div
              id="settings_drawer_content"
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:w-96 bg-white h-full flex flex-col shadow-2xl p-6 overflow-y-auto space-y-6"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-zinc-100 rounded-lg text-zinc-900">
                    <Settings2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-zinc-900 leading-none">Sandbox Settings</h3>
                    <span className="text-[10px] text-zinc-400 font-mono">Parameters &amp; Instructions</span>
                  </div>
                </div>
                <button
                  id="settings_drawer_close"
                  onClick={() => setShowSettings(false)}
                  className="rounded-lg p-1.5 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Workspaces Section on Mobile Overlay Only */}
              <div className="space-y-3 md:hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono block">
                    Change Workspace
                  </span>
                  <button
                    id="new_thread_button_mobile"
                    onClick={() => {
                      createNewThread();
                    }}
                    className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Create
                  </button>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto border border-zinc-100 p-2.5 rounded-xl bg-zinc-50/50">
                  {threads.map((thread) => {
                    const isActive = thread.id === activeThreadId;
                    return (
                      <div
                        id={`mobile_thread_item_${thread.id}`}
                        key={thread.id}
                        onClick={() => {
                          selectThread(thread.id);
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          isActive ? 'bg-white text-zinc-900 font-semibold shadow-sm border border-zinc-200/60' : 'text-zinc-600 hover:bg-zinc-100'
                        }`}
                      >
                        <span className="truncate pr-2">{thread.title}</span>
                        <button
                          id={`mobile_delete_thread_${thread.id}`}
                          onClick={(e) => deleteThread(thread.id, e)}
                          className="p-1 text-zinc-400 hover:text-red-500 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Model selection */}
              <div className="space-y-3">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono block">
                  Select Gemini Model
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    id="model_select_flash"
                    onClick={() => {
                      setSelectedModel('gemini-3.5-flash');
                      updateActiveThreadConfig({ model: 'gemini-3.5-flash' });
                    }}
                    className={`flex items-start gap-3 p-3.5 rounded-xl text-left border text-sm transition-all hover:bg-zinc-50 ${
                      selectedModel === 'gemini-3.5-flash'
                        ? 'border-indigo-500 bg-indigo-50/5 ring-1 ring-indigo-500'
                        : 'border-zinc-200'
                    }`}
                  >
                    <Cpu className={`w-5 h-5 mt-0.5 flex-shrink-0 ${selectedModel === 'gemini-3.5-flash' ? 'text-indigo-500' : 'text-zinc-400'}`} />
                    <div>
                      <span className="font-semibold text-zinc-900 block leading-tight">Gemini 3.5 Flash</span>
                      <span className="text-xs text-zinc-400 leading-normal block mt-0.5 font-sans">Excellent fast general reasoning</span>
                    </div>
                  </button>

                  <button
                    id="model_select_pro"
                    onClick={() => {
                      setSelectedModel('gemini-3.1-pro-preview');
                      updateActiveThreadConfig({ model: 'gemini-3.1-pro-preview' });
                    }}
                    className={`flex items-start gap-3 p-3.5 rounded-xl text-left border text-sm transition-all hover:bg-zinc-50 ${
                      selectedModel === 'gemini-3.1-pro-preview'
                        ? 'border-indigo-500 bg-indigo-50/5 ring-1 ring-indigo-500'
                        : 'border-zinc-200'
                    }`}
                  >
                    <Activity className={`w-5 h-5 mt-0.5 flex-shrink-0 ${selectedModel === 'gemini-3.1-pro-preview' ? 'text-indigo-500' : 'text-zinc-400'}`} />
                    <div>
                      <span className="font-semibold text-zinc-900 block leading-tight">Gemini 3.1 Pro</span>
                      <span className="text-xs text-zinc-400 leading-normal block mt-0.5 font-sans">Elite capability for logic &amp; coding</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* System Instructions / Persona Block */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono block">
                    System Instructions
                  </label>
                  {customSystemInstruction && (
                    <button
                      id="clear_system_instruction_action"
                      onClick={() => {
                        setCustomSystemInstruction('');
                        updateActiveThreadConfig({ systemInstruction: '' });
                      }}
                      className="text-[10px] text-red-500 hover:underline hover:text-red-600 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  id="system_instruction_input"
                  value={customSystemInstruction}
                  onChange={(e) => {
                    setCustomSystemInstruction(e.target.value);
                    updateActiveThreadConfig({ systemInstruction: e.target.value });
                  }}
                  placeholder="Tell the AI who it should roleplay as, or specify strict output templates..."
                  className="w-full h-36 p-3 bg-zinc-50 border border-zinc-200 focus:border-zinc-950 focus:bg-white focus:outline-none rounded-xl text-xs leading-relaxed text-zinc-700 placeholder-zinc-400 font-mono transition-all"
                />
                <span className="text-[10px] text-zinc-400 block leading-normal">
                  Dynamic behavior rules are applied instantly on the server side to all messages sent in this workspace thread.
                </span>
              </div>

              {/* Quick Persona Selector */}
              <div className="space-y-3 pt-4 border-t border-zinc-150">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono block">
                  Quick Persona Loader
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_PERSONAS.map((person, idx) => (
                    <button
                      id={`drawer_persona_btn_${idx}`}
                      key={idx}
                      onClick={() => {
                        setCustomSystemInstruction(person.instruction);
                        updateActiveThreadConfig({ systemInstruction: person.instruction });
                      }}
                      className={`text-xs p-2.5 text-left rounded-xl border transition-all ${
                        customSystemInstruction === person.instruction
                          ? 'border-indigo-500 bg-indigo-50/10 font-medium text-indigo-900 ring-1 ring-indigo-500'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                      }`}
                    >
                      <span className="mr-1.5">{person.emoji}</span>
                      {person.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Apply Button */}
              <div className="pt-4 mt-auto">
                <button
                  id="drawer_save_and_close"
                  onClick={() => setShowSettings(false)}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-3 px-4 rounded-xl transition text-xs shadow-sm flex items-center justify-center gap-1.5"
                >
                  Apply Settings
                </button>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
