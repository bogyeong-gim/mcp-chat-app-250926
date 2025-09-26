"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Settings, Bot, User, X, RotateCcw, Paperclip, File, Server } from "lucide-react";
import MarkdownRenderer from "../components/MarkdownRenderer";
import FileUpload from "../components/FileUpload";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";

interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'text' | 'video' | 'audio' | 'other';
}

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  isStreaming?: boolean;
  files?: UploadedFile[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // LocalStorage에서 메시지 불러오기
  useEffect(() => {
    const savedMessages = localStorage.getItem('chat-messages');
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed.map((msg: unknown) => ({
          ...msg as Message,
          timestamp: new Date((msg as Message).timestamp)
        })));
      } catch (error) {
        console.error('Failed to load messages from localStorage:', error);
      }
    }
  }, []);

  // 메시지가 변경될 때마다 LocalStorage에 저장
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chat-messages', JSON.stringify(messages));
    }
  }, [messages]);

  // 메시지 목록이 업데이트될 때마다 스크롤을 맨 아래로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = async (files: UploadedFile[]) => {
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file.file);
      });

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('파일 업로드에 실패했습니다.');
      }

      const result = await response.json();
      console.log('파일 업로드 성공:', result);
      return result;
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      setError('파일 업로드 중 오류가 발생했습니다.');
      return null;
    }
  };

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && uploadedFiles.length === 0) || isLoading) return;

    // 프롬프트 명령어 처리
    if (inputValue.startsWith('/')) {
      handlePromptCommand(inputValue);
      return;
    }

    // 파일이 있으면 먼저 업로드
    let uploadedFileData = null;
    if (uploadedFiles.length > 0) {
      uploadedFileData = await handleFileUpload(uploadedFiles);
      if (!uploadedFileData) {
        return; // 업로드 실패 시 중단
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      role: "user",
      timestamp: new Date(),
      files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    // const currentFiles = uploadedFiles;
    setInputValue("");
    setUploadedFiles([]);
    setShowFileUpload(false);
    setIsLoading(true);
    setError(null);

    // AI 응답 메시지 생성 (스트리밍용)
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: Message = {
      id: aiMessageId,
      content: "",
      role: "assistant",
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, aiMessage]);

    try {
      // 이전 요청이 있다면 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // 새로운 AbortController 생성
      abortControllerRef.current = new AbortController();

      // 채팅 히스토리를 Gemini API 형식으로 변환
      const chatHistory = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: currentInput,
          history: chatHistory
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'token') {
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === aiMessageId 
                      ? { ...msg, content: msg.content + data.content }
                      : msg
                  )
                );
              } else if (data.type === 'done') {
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === aiMessageId 
                      ? { ...msg, isStreaming: false }
                      : msg
                  )
                );
              } else if (data.type === 'error') {
                setError(data.content);
                setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted');
      } else {
        console.error('Streaming error:', error);
        setError('응답을 받는 중 오류가 발생했습니다. 다시 시도해주세요.');
        
        // 에러 발생 시 스트리밍 메시지 제거
        setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setMessages(prev => 
        prev.map(msg => 
          msg.isStreaming ? { ...msg, isStreaming: false } : msg
        )
      );
    }
  };

  const handleRetry = () => {
    setError(null);
    if (messages.length > 0) {
      const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
      if (lastUserMessage) {
        setInputValue(lastUserMessage.content);
        handleSendMessage();
      }
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
    localStorage.removeItem('chat-messages');
  };

  const handlePromptCommand = (command: string) => {
    switch (command) {
      case '/clear':
        handleClearChat();
        setInputValue('');
        break;
      case '/help':
        setInputValue('사용 가능한 명령어:\n/clear - 대화 초기화\n/help - 도움말');
        break;
      default:
        break;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* 상단 헤더 - 모델/서버 관리 */}
      <Card className="rounded-none border-x-0 border-t-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl">AI 채팅</CardTitle>
              <Badge variant="secondary">Gemini 2.0 Flash</Badge>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <Button 
                  onClick={handleClearChat}
                  variant="destructive"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  대화 초기화
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2"
                onClick={() => window.location.href = '/mcp-servers'}
              >
                <Server className="w-4 h-4" />
                MCP 서버
              </Button>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                설정
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 채팅 메시지 영역 */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-medium mb-2">
                AI와 대화를 시작해보세요
              </h2>
              <p className="text-muted-foreground mb-4">
                메시지를 입력하고 Enter를 눌러 전송하세요
              </p>
              <Badge variant="outline" className="text-xs">
                💡 &quot;/&quot;를 입력하면 프롬프트 힌트를 볼 수 있습니다
              </Badge>
            </CardContent>
          </Card>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
              
              <Card
                className={`max-w-[70%] ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : ""
                }`}
              >
                <CardContent className="p-4">
                  {/* 파일 표시 */}
                  {message.files && message.files.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {message.files.map((file) => (
                        <div key={file.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                          <File className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm truncate">{file.file.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {file.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {message.role === "user" ? (
                    <p className="whitespace-pre-wrap">
                      {message.content}
                      {message.isStreaming && (
                        <span className="inline-block w-2 h-4 bg-primary-foreground ml-1 animate-pulse" />
                      )}
                    </p>
                  ) : (
                    <div className="relative">
                      <MarkdownRenderer 
                        content={message.content} 
                        isStreaming={message.isStreaming}
                      />
                      {message.isStreaming && (
                        <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                    {message.isStreaming && (
                      <Button
                        onClick={handleCancelStreaming}
                        variant="destructive"
                        size="sm"
                        className="h-6 px-2 text-xs"
                      >
                        <X className="w-3 h-3 mr-1" />
                        취소
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {message.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          ))
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 bg-destructive rounded-full flex items-center justify-center">
              <X className="w-4 h-4 text-destructive-foreground" />
            </div>
            <Alert variant="destructive" className="max-w-[70%]">
              <AlertDescription className="mb-2">{error}</AlertDescription>
              <Button
                onClick={handleRetry}
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                다시 시도
              </Button>
            </Alert>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* 하단 입력창 */}
      <Card className="rounded-none border-x-0 border-b-0">
        <CardContent className="p-4">
          {/* 파일 업로드 영역 */}
          {showFileUpload && (
            <div className="mb-4">
              <FileUpload
                onFilesChange={setUploadedFiles}
                disabled={isLoading}
                maxFiles={5}
                maxSize={10}
              />
            </div>
          )}

          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  isLoading 
                    ? "AI가 응답 중입니다..." 
                    : "메시지를 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
                }
                disabled={isLoading}
                className="resize-none"
                rows={1}
                style={{
                  minHeight: "48px",
                  maxHeight: "120px",
                  height: "auto",
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                }}
              />
              {inputValue.startsWith("/") && !isLoading && (
                <Card className="absolute bottom-full left-0 mb-2 shadow-lg">
                  <CardContent className="p-3">
                    <p className="font-medium text-sm mb-2">프롬프트 명령어:</p>
                    <div className="space-y-1">
                      <Badge variant="outline" className="text-xs">/help - 도움말 보기</Badge>
                      <Badge variant="outline" className="text-xs">/clear - 대화 초기화</Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            
            {/* 파일 업로드 버튼 */}
            <Button
              onClick={() => setShowFileUpload(!showFileUpload)}
              disabled={isLoading}
              variant="outline"
              size="icon"
              className="w-12 h-12"
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            
            <Button
              onClick={isLoading ? handleCancelStreaming : handleSendMessage}
              disabled={(!inputValue.trim() && uploadedFiles.length === 0) && !isLoading}
              size="icon"
              variant={isLoading ? "destructive" : "default"}
              className="w-12 h-12"
            >
              {isLoading ? (
                <X className="w-5 h-5" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
          
          {/* 업로드된 파일 표시 */}
          {uploadedFiles.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-muted-foreground mb-2">업로드된 파일:</p>
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                    <File className="w-4 h-4" />
                    <span className="truncate max-w-32">{file.file.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {file.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 스트리밍 상태 표시 */}
          {isLoading && (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
              <span>AI가 응답을 생성하고 있습니다...</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
