"use client";

import { useState, useEffect } from "react";
import { Plus, Server, Settings, Trash2, Play, Square, AlertCircle, CheckCircle, XCircle, ArrowLeft, Wrench, FileText, Lightbulb, X, Upload, Download } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
// MCP 클라이언트는 서버 사이드에서 처리됩니다

interface MCPServer {
  id: string;
  name: string;
  description?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  transport?: 'stdio' | 'http';
  authToken?: string;
  headers?: Record<string, string>;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastConnected?: Date;
  error?: string;
}

export default function MCPServersPage() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const [serverDetails, setServerDetails] = useState<{
    tools: unknown[];
    resources: unknown[];
    prompts: unknown[];
  }>({ tools: [], resources: [], prompts: [] });
  const [toolExecution, setToolExecution] = useState<{
    toolName: string;
    arguments: string;
    result: unknown | null;
    loading: boolean;
  }>({ toolName: '', arguments: '', result: null, loading: false });
  const [serverCapabilities, setServerCapabilities] = useState<Record<string, {
    tools: unknown[];
    resources: unknown[];
    prompts: unknown[];
  }>>({});
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    command: '',
    args: '',
    env: '',
    url: '',
    transport: 'stdio' as 'stdio' | 'http',
    authToken: '',
    headers: ''
  });

  // LocalStorage에서 서버 목록 불러오기
  useEffect(() => {
    const savedServers = localStorage.getItem('mcp-servers');
    if (savedServers) {
      try {
        const parsed = JSON.parse(savedServers);
        setServers(parsed.map((server: unknown) => ({
          ...server as MCPServer,
          lastConnected: (server as MCPServer).lastConnected ? new Date((server as MCPServer).lastConnected!) : undefined
        })));
      } catch (error) {
        console.error('Failed to load MCP servers from localStorage:', error);
      }
    }
  }, []);

  // 서버 목록이 변경될 때마다 LocalStorage에 저장
  useEffect(() => {
    if (servers.length > 0) {
      localStorage.setItem('mcp-servers', JSON.stringify(servers));
    }
  }, [servers]);

  const handleAddServer = () => {
    if (!formData.name.trim() || (!formData.command.trim() && !formData.url.trim())) {
      return;
    }

    const newServer: MCPServer = {
      id: Date.now().toString(),
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      command: formData.command.trim() || undefined,
      args: formData.args.trim() ? formData.args.split(' ').filter(arg => arg.trim()) : undefined,
      env: formData.env.trim() ? JSON.parse(formData.env) : undefined,
      url: formData.url.trim() || undefined,
      transport: formData.transport,
      authToken: formData.authToken.trim() || undefined,
      headers: formData.headers.trim() ? JSON.parse(formData.headers) : undefined,
      status: 'disconnected'
    };

    setServers(prev => [...prev, newServer]);
    setFormData({ name: '', description: '', command: '', args: '', env: '', url: '', transport: 'stdio', authToken: '', headers: '' });
    setShowAddForm(false);
  };

  const handleEditServer = (server: MCPServer) => {
    setEditingServer(server);
    setFormData({
      name: server.name,
      description: server.description || '',
      command: server.command || '',
      args: server.args?.join(' ') || '',
      env: server.env ? JSON.stringify(server.env, null, 2) : '',
      url: server.url || '',
      transport: server.transport || 'stdio',
      authToken: server.authToken || '',
      headers: server.headers ? JSON.stringify(server.headers, null, 2) : ''
    });
    setShowAddForm(true);
  };

  const handleUpdateServer = () => {
    if (!editingServer || !formData.name.trim() || (!formData.command.trim() && !formData.url.trim())) {
      return;
    }

    const updatedServer: MCPServer = {
      ...editingServer,
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      command: formData.command.trim() || undefined,
      args: formData.args.trim() ? formData.args.split(' ').filter(arg => arg.trim()) : undefined,
      env: formData.env.trim() ? JSON.parse(formData.env) : undefined,
      url: formData.url.trim() || undefined,
      transport: formData.transport,
      authToken: formData.authToken.trim() || undefined,
      headers: formData.headers.trim() ? JSON.parse(formData.headers) : undefined,
    };

    setServers(prev => prev.map(server => 
      server.id === editingServer.id ? updatedServer : server
    ));
    
    setFormData({ name: '', description: '', command: '', args: '', env: '', url: '', transport: 'stdio', authToken: '', headers: '' });
    setEditingServer(null);
    setShowAddForm(false);
  };

  const handleDeleteServer = (serverId: string) => {
    setServers(prev => prev.filter(server => server.id !== serverId));
  };

  const handleConnectServer = async (server: MCPServer) => {
    setServers(prev => prev.map(s => 
      s.id === server.id ? { ...s, status: 'connecting' as const } : s
    ));

    try {
      // API를 통한 MCP 서버 연결
      const response = await fetch('/api/mcp/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: server.id,
          name: server.name,
          command: server.command,
          args: server.args,
          env: server.env,
          url: server.url,
          transport: server.transport,
          authToken: server.authToken,
          headers: server.headers
        })
      });

      const result = await response.json();

      if (result.success) {
        setServers(prev => prev.map(s => 
          s.id === server.id ? { 
            ...s, 
            status: 'connected' as const, 
            lastConnected: new Date(),
            error: undefined
          } : s
        ));
        
        // 연결 성공 시 서버 기능 정보 자동 로드
        try {
          const detailsResponse = await fetch('/api/mcp/details', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              connectionId: server.id
            })
          });

          const detailsResult = await detailsResponse.json();
          if (detailsResult.success) {
            setServerCapabilities(prev => ({
              ...prev,
              [server.id]: detailsResult.details
            }));
          }
        } catch (error) {
          console.log('서버 기능 정보 로드 실패 (선택사항):', error);
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      setServers(prev => prev.map(s => 
        s.id === server.id ? { 
          ...s, 
          status: 'error' as const, 
          error: error instanceof Error ? error.message : '연결 실패'
        } : s
      ));
    }
  };

  const handleDisconnectServer = async (server: MCPServer) => {
    try {
      const response = await fetch('/api/mcp/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionId: server.id
        })
      });

      const result = await response.json();

      if (result.success) {
        setServers(prev => prev.map(s => 
          s.id === server.id ? { ...s, status: 'disconnected' as const } : s
        ));
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('MCP 서버 연결 해제 실패:', error);
      setServers(prev => prev.map(s => 
        s.id === server.id ? { 
          ...s, 
          status: 'error' as const, 
          error: error instanceof Error ? error.message : '연결 해제 실패'
        } : s
      ));
    }
  };

  const handleViewServerDetails = async (server: MCPServer) => {
    if (server.status !== 'connected') {
      alert('서버가 연결되지 않았습니다. 먼저 서버에 연결해주세요.');
      return;
    }

    setSelectedServer(server);
    
    try {
      const response = await fetch('/api/mcp/details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionId: server.id
        })
      });

      const result = await response.json();

      if (result.success) {
        setServerDetails(result.details);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('서버 세부 정보 조회 실패:', error);
      alert('서버 세부 정보를 가져오는데 실패했습니다.');
    }
  };

  const handleImportJson = () => {
    try {
      const jsonData = JSON.parse(jsonInput);
      
      if (!jsonData.mcpServers) {
        alert('올바른 MCP 서버 JSON 형식이 아닙니다.');
        return;
      }

      const newServers: MCPServer[] = [];
      
      Object.entries(jsonData.mcpServers).forEach(([name, config]: [string, unknown]) => {
        const configObj = config as { command?: string; args?: string[]; env?: Record<string, string> };
        const server: MCPServer = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: name,
          description: `JSON에서 가져온 ${name} 서버`,
          command: configObj.command,
          args: configObj.args,
          env: configObj.env || {},
          transport: 'stdio',
          status: 'disconnected'
        };
        newServers.push(server);
      });

      setServers(prev => [...prev, ...newServers]);
      setShowJsonImport(false);
      setJsonInput('');
      alert(`${newServers.length}개의 서버가 추가되었습니다.`);
    } catch {
      alert('JSON 형식이 올바르지 않습니다. 다시 확인해주세요.');
    }
  };

  const handleExportJson = () => {
    const mcpServers: Record<string, unknown> = {};
    
    servers.forEach(server => {
      if (server.transport === 'stdio' && server.command) {
        mcpServers[server.name] = {
          command: server.command,
          args: server.args || [],
          env: server.env || {}
        };
      }
    });

    const jsonData = { mcpServers };
    const jsonString = JSON.stringify(jsonData, null, 2);
    
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mcp-servers.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExecuteTool = async (toolName: string) => {
    if (!selectedServer) return;

    setToolExecution(prev => ({ ...prev, toolName, loading: true, result: null }));

    try {
      const response = await fetch('/api/mcp/call-tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionId: selectedServer.id,
          toolName,
          arguments: toolExecution.arguments ? JSON.parse(toolExecution.arguments) : {}
        })
      });

      const result = await response.json();

      if (result.success) {
        setToolExecution(prev => ({ ...prev, result: result.result, loading: false }));
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('도구 실행 실패:', error);
      setToolExecution(prev => ({ 
        ...prev, 
        result: { error: error instanceof Error ? error.message : '도구 실행 실패' },
        loading: false 
      }));
    }
  };

  const getStatusIcon = (status: MCPServer['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'connecting':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Square className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: MCPServer['status']) => {
    switch (status) {
      case 'connected':
        return <Badge variant="default" className="bg-green-500">연결됨</Badge>;
      case 'connecting':
        return <Badge variant="secondary">연결 중...</Badge>;
      case 'error':
        return <Badge variant="destructive">오류</Badge>;
      default:
        return <Badge variant="outline">연결 안됨</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = '/'}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              채팅으로 돌아가기
            </Button>
            <div>
              <h1 className="text-3xl font-bold">MCP 서버 관리</h1>
              <p className="text-muted-foreground mt-1">
                Model Context Protocol 서버를 등록하고 관리하세요
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              서버 추가
            </Button>
            <Button 
              onClick={() => {
                setJsonInput(`{
  "mcpServers": {
    "typescript-mcp-server-boilerplate": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "@smithery/cli@latest",
        "run",
        "@devbrother2024/typescript-mcp-server-boilerplate",
        "--key",
        "7b1fc6ba-396f-4675-9675-a66b0ec9ebca"
      ]
    }
  }
}`);
                setShowJsonImport(true);
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              JSON 가져오기
            </Button>
            <Button 
              onClick={handleExportJson}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              JSON 내보내기
            </Button>
            <Button 
              onClick={() => {
                setFormData({
                  name: 'Smithery MCP Server',
                  description: 'Smithery에서 제공하는 TypeScript MCP 서버 보일러플레이트',
                  command: '',
                  args: '',
                  env: '',
                  url: 'https://server.smithery.ai/@devbrother2024/typescript-mcp-server-boilerplate/mcp',
                  transport: 'http',
                  authToken: '',
                  headers: ''
                });
                setShowAddForm(true);
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Server className="w-4 h-4" />
              Smithery 서버 추가
            </Button>
            <Button 
              onClick={() => {
                setFormData({
                  name: '로컬 파일 시스템 서버',
                  description: '로컬 파일 시스템에 접근할 수 있는 MCP 서버 (테스트용)',
                  command: 'npx',
                  args: '@modelcontextprotocol/server-filesystem --root ./public',
                  env: '{}',
                  url: '',
                  transport: 'stdio',
                  authToken: '',
                  headers: ''
                });
                setShowAddForm(true);
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              로컬 서버 추가
            </Button>
            <Button 
              onClick={() => {
                setFormData({
                  name: 'Smithery CLI 서버',
                  description: 'Smithery CLI를 사용한 TypeScript MCP 서버',
                  command: 'cmd',
                  args: '/c npx -y @smithery/cli@latest run @devbrother2024/typescript-mcp-server-boilerplate --key 7b1fc6ba-396f-4675-9675-a66b0ec9ebca',
                  env: '{}',
                  url: '',
                  transport: 'stdio',
                  authToken: '',
                  headers: ''
                });
                setShowAddForm(true);
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Server className="w-4 h-4" />
              Smithery CLI 서버
            </Button>
          </div>
        </div>

        {/* JSON 가져오기 모달 */}
        {showJsonImport && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                JSON 설정 가져오기
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="jsonInput">MCP 서버 JSON 설정</Label>
                <Textarea
                  id="jsonInput"
                  value={jsonInput}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJsonInput(e.target.value)}
                  placeholder={`{
  "mcpServers": {
    "typescript-mcp-server-boilerplate": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "@smithery/cli@latest",
        "run",
        "@devbrother2024/typescript-mcp-server-boilerplate",
        "--key",
        "7b1fc6ba-396f-4675-9675-a66b0ec9ebca"
      ]
    }
  }
}`}
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleImportJson} disabled={!jsonInput.trim()}>
                  가져오기
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowJsonImport(false);
                    setJsonInput('');
                  }}
                >
                  취소
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 서버 추가/수정 폼 */}
        {showAddForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                {editingServer ? '서버 수정' : '새 서버 추가'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">서버 이름 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="예: 파일 시스템 서버"
                  />
                </div>
                <div>
                  <Label htmlFor="transport">전송 방식 *</Label>
                  <select
                    id="transport"
                    value={formData.transport}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, transport: e.target.value as 'stdio' | 'http' }))}
                    className="w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md"
                  >
                    <option value="stdio">Stdio (로컬 프로세스)</option>
                    <option value="http">HTTP (원격 서버)</option>
                  </select>
                </div>
              </div>

              {formData.transport === 'stdio' ? (
                <div>
                  <Label htmlFor="command">실행 명령어 *</Label>
                  <Input
                    id="command"
                    value={formData.command}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, command: e.target.value }))}
                    placeholder="예: npx @modelcontextprotocol/server-filesystem"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="url">서버 URL *</Label>
                  <Input
                    id="url"
                    value={formData.url}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="예: https://server.smithery.ai/@devbrother2024/typescript-mcp-server-boilerplate/mcp"
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="description">설명</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="서버에 대한 간단한 설명"
                />
              </div>

              <div>
                <Label htmlFor="args">인수 (공백으로 구분)</Label>
                <Input
                  id="args"
                  value={formData.args}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, args: e.target.value }))}
                  placeholder="예: --root /path/to/directory"
                />
              </div>

              {formData.transport === 'http' && (
                <>
                  <div>
                    <Label htmlFor="authToken">인증 토큰 (선택사항)</Label>
                    <Input
                      id="authToken"
                      type="password"
                      value={formData.authToken}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, authToken: e.target.value }))}
                      placeholder="Bearer 토큰 또는 API 키"
                    />
                  </div>
                  <div>
                    <Label htmlFor="headers">추가 HTTP 헤더 (JSON 형식)</Label>
                    <Textarea
                      id="headers"
                      value={formData.headers}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, headers: e.target.value }))}
                      placeholder='{"X-Custom-Header": "value"}'
                      rows={2}
                    />
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="env">환경 변수 (JSON 형식)</Label>
                <Textarea
                  id="env"
                  value={formData.env}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, env: e.target.value }))}
                  placeholder='{"API_KEY": "your-key", "DEBUG": "true"}'
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={editingServer ? handleUpdateServer : handleAddServer}
                  disabled={!formData.name.trim() || (!formData.command.trim() && !formData.url.trim())}
                >
                  {editingServer ? '수정' : '추가'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingServer(null);
                    setFormData({ name: '', description: '', command: '', args: '', env: '', url: '', transport: 'stdio', authToken: '', headers: '' });
                  }}
                >
                  취소
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 서버 목록 */}
        {servers.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Server className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-medium mb-2">
                등록된 MCP 서버가 없습니다
              </h2>
              <p className="text-muted-foreground mb-4">
                첫 번째 MCP 서버를 추가해보세요
              </p>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                서버 추가
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.map((server) => (
              <Card key={server.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(server.status)}
                      <CardTitle className="text-lg">{server.name}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                      {server.status === 'connected' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewServerDetails(server)}
                          title="서버 세부 정보 보기"
                        >
                          <Wrench className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditServer(server)}
                        title="서버 수정"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteServer(server.id)}
                        title="서버 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {server.description && (
                    <p className="text-sm text-muted-foreground">
                      {server.description}
                    </p>
                  )}
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {server.transport === 'http' ? (
                    <div>
                      <p className="text-sm font-medium mb-1">URL:</p>
                      <code className="text-xs bg-muted px-2 py-1 rounded block">
                        {server.url}
                      </code>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium mb-1">명령어:</p>
                      <code className="text-xs bg-muted px-2 py-1 rounded block">
                        {server.command} {server.args?.join(' ')}
                      </code>
                    </div>
                  )}

                  {server.env && Object.keys(server.env).length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-1">환경 변수:</p>
                      <div className="text-xs text-muted-foreground">
                        {Object.keys(server.env).length}개 설정됨
                      </div>
                    </div>
                  )}

                  {/* 서버 기능 정보 표시 */}
                  {server.status === 'connected' && serverCapabilities[server.id] && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-blue-500" />
                          <span className="text-muted-foreground">
                            도구 {serverCapabilities[server.id].tools.length}개
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-green-500" />
                          <span className="text-muted-foreground">
                            리소스 {serverCapabilities[server.id].resources.length}개
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Lightbulb className="w-3 h-3 text-yellow-500" />
                          <span className="text-muted-foreground">
                            프롬프트 {serverCapabilities[server.id].prompts.length}개
                          </span>
                        </div>
                      </div>
                      
                      {/* 도구 미리보기 */}
                      {serverCapabilities[server.id].tools.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1">사용 가능한 도구:</p>
                          <div className="flex flex-wrap gap-1">
                            {serverCapabilities[server.id].tools.slice(0, 3).map((tool: unknown, index: number) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {(tool as { name: string }).name}
                              </Badge>
                            ))}
                            {serverCapabilities[server.id].tools.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{serverCapabilities[server.id].tools.length - 3}개 더
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 프롬프트 미리보기 */}
                      {serverCapabilities[server.id].prompts.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1">사용 가능한 프롬프트:</p>
                          <div className="flex flex-wrap gap-1">
                            {serverCapabilities[server.id].prompts.slice(0, 2).map((prompt: unknown, index: number) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {(prompt as { name: string }).name}
                              </Badge>
                            ))}
                            {serverCapabilities[server.id].prompts.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{serverCapabilities[server.id].prompts.length - 2}개 더
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    {getStatusBadge(server.status)}
                    <div className="flex gap-1">
                      {server.status === 'connected' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnectServer(server)}
                        >
                          <Square className="w-4 h-4 mr-1" />
                          연결 해제
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleConnectServer(server)}
                          disabled={server.status === 'connecting'}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          연결
                        </Button>
                      )}
                    </div>
                  </div>

                  {server.error && (
                    <Alert variant="destructive">
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription className="text-xs">
                        {server.error}
                        {server.error.includes('Rate Limited') && (
                          <div className="mt-2">
                            <strong>해결 방법:</strong>
                            <ul className="list-disc list-inside mt-1 space-y-1">
                              <li>잠시 후 다시 시도해주세요</li>
                              <li>로컬 MCP 서버를 사용해보세요</li>
                              <li>다른 시간대에 연결을 시도해보세요</li>
                            </ul>
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  {server.lastConnected && (
                    <p className="text-xs text-muted-foreground">
                      마지막 연결: {server.lastConnected.toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 보안 경고 */}
        <Alert className="mt-6">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            <strong>보안 주의:</strong> 공용 또는 공유 PC에서는 민감한 정보(API 키, 토큰 등)를 
            저장하지 마세요. 모든 데이터는 브라우저의 localStorage에 저장됩니다.
          </AlertDescription>
        </Alert>

        {/* Rate Limit 알림 */}
        <Alert className="mt-4" variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            <strong>Smithery 서버 연결 문제:</strong> 현재 Smithery 서버가 Rate Limit로 인해 
            일시적으로 제한되고 있습니다. 로컬 MCP 서버를 사용하거나 잠시 후 다시 시도해주세요.
            <br />
            <strong>해결 방법:</strong> &quot;로컬 서버 추가&quot; 버튼을 사용하여 로컬 파일 시스템 서버를 추가해보세요.
          </AlertDescription>
        </Alert>

        {/* 서버 세부 정보 모달 */}
        {selectedServer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5" />
                    {selectedServer.name} - 서버 세부 정보
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    연결된 MCP 서버의 도구, 리소스, 프롬프트 정보
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedServer(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              
              <CardContent className="overflow-y-auto max-h-[60vh]">
                {/* 도구 실행 섹션 */}
                <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Wrench className="w-4 h-4" />
                    <h4 className="font-medium">도구 실행</h4>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="toolArgs">도구 인수 (JSON 형식)</Label>
                      <Textarea
                        id="toolArgs"
                        value={toolExecution.arguments}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                          setToolExecution(prev => ({ ...prev, arguments: e.target.value }))
                        }
                        placeholder='{"param1": "value1", "param2": "value2"}'
                        rows={3}
                        className="font-mono text-sm"
                      />
                    </div>
                    {toolExecution.result !== null && (
                      <div>
                        <p className="text-sm font-medium mb-2">실행 결과:</p>
                        <div className="bg-background p-3 rounded border">
                          <pre className="text-xs overflow-x-auto">
                            {JSON.stringify(toolExecution.result, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 도구 섹션 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Wrench className="w-4 h-4" />
                      <h3 className="font-semibold">도구 ({serverDetails.tools.length})</h3>
                    </div>
                    <div className="space-y-2">
                      {serverDetails.tools.length === 0 ? (
                        <p className="text-sm text-muted-foreground">사용 가능한 도구가 없습니다</p>
                      ) : (
                        serverDetails.tools.map((tool: unknown, index: number) => (
                          <div key={index} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-medium text-sm">{(tool as { name: string }).name}</div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleExecuteTool((tool as { name: string }).name)}
                                disabled={toolExecution.loading}
                                className="text-xs"
                              >
                                {toolExecution.loading && toolExecution.toolName === (tool as { name: string }).name ? '실행 중...' : '실행'}
                              </Button>
                            </div>
                            {(tool as { description?: string }).description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {(tool as { description: string }).description}
                              </p>
                            )}
                            {(tool as { inputSchema?: unknown }).inputSchema !== undefined && (
                              <div className="mt-2">
                                <p className="text-xs font-medium">입력 스키마:</p>
                                <code className="text-xs bg-muted px-2 py-1 rounded block mt-1">
                                  {JSON.stringify((tool as { inputSchema: unknown }).inputSchema, null, 2)}
                                </code>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 리소스 섹션 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4" />
                      <h3 className="font-semibold">리소스 ({serverDetails.resources.length})</h3>
                    </div>
                    <div className="space-y-2">
                      {serverDetails.resources.length === 0 ? (
                        <p className="text-sm text-muted-foreground">사용 가능한 리소스가 없습니다</p>
                      ) : (
                        serverDetails.resources.map((resource: unknown, index: number) => (
                          <div key={index} className="p-3 border rounded-lg">
                            <div className="font-medium text-sm">{(resource as { name: string }).name}</div>
                            {(resource as { description?: string }).description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {(resource as { description: string }).description}
                              </p>
                            )}
                            <div className="mt-2">
                              <p className="text-xs font-medium">URI:</p>
                              <code className="text-xs bg-muted px-2 py-1 rounded block mt-1">
                                {(resource as { uri: string }).uri}
                              </code>
                            </div>
                            {(resource as { mimeType?: string }).mimeType && (
                              <div className="mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {(resource as { mimeType: string }).mimeType}
                                </Badge>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 프롬프트 섹션 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4" />
                      <h3 className="font-semibold">프롬프트 ({serverDetails.prompts.length})</h3>
                    </div>
                    <div className="space-y-2">
                      {serverDetails.prompts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">사용 가능한 프롬프트가 없습니다</p>
                      ) : (
                        serverDetails.prompts.map((prompt: unknown, index: number) => (
                          <div key={index} className="p-3 border rounded-lg">
                            <div className="font-medium text-sm">{(prompt as { name: string }).name}</div>
                            {(prompt as { description?: string }).description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {(prompt as { description: string }).description}
                              </p>
                            )}
                            {(prompt as { arguments?: unknown[] }).arguments && (prompt as { arguments: unknown[] }).arguments.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium">인수:</p>
                                <div className="space-y-1 mt-1">
                                  {(prompt as { arguments: unknown[] }).arguments.map((arg: unknown, argIndex: number) => (
                                    <div key={argIndex} className="text-xs">
                                      <span className="font-medium">{(arg as { name: string }).name}</span>
                                      {(arg as { description?: string }).description && (
                                        <span className="text-muted-foreground ml-1">
                                          - {(arg as { description: string }).description}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
