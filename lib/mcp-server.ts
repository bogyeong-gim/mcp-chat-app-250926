import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface MCPServerConfig {
  id: string;
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string; // HTTP 기반 MCP 서버 URL
  transport?: 'stdio' | 'http'; // 전송 방식
  authToken?: string; // 인증 토큰
  headers?: Record<string, string>; // 추가 HTTP 헤더
}

export interface MCPConnection {
  client: Client;
  transport: unknown;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  error?: string;
  lastConnected?: Date;
}

class MCPServerManager {
  private connections: Map<string, MCPConnection> = new Map();

  async connectToServer(config: MCPServerConfig, retryCount = 0): Promise<MCPConnection> {
    const connectionId = config.id;
    
    // 이미 연결된 서버가 있다면 기존 연결 반환
    if (this.connections.has(connectionId)) {
      const existing = this.connections.get(connectionId)!;
      if (existing.status === 'connected') {
        return existing;
      }
    }

    // 연결 상태로 설정
    const connection: MCPConnection = {
      client: new Client({
        name: "mcp-manager",
        version: "1.0.0"
      }),
      transport: null,
      status: 'connecting'
    };

    this.connections.set(connectionId, connection);

    try {
      let transport;

      // 전송 방식에 따라 다른 transport 사용
      if (config.transport === 'http' && config.url) {
        // HTTP 기반 MCP 서버 연결
        const url = new URL(config.url);
        
        // 인증 헤더 추가
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...config.headers
        };
        
        if (config.authToken) {
          headers['Authorization'] = `Bearer ${config.authToken}`;
        }
        
        transport = new StreamableHTTPClientTransport(url);
      } else if (config.command) {
        // Stdio 기반 MCP 서버 연결
        transport = new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env: config.env
        });
      } else {
        throw new Error('연결할 서버 정보가 올바르지 않습니다 (command 또는 url 필요)');
      }

      await connection.client.connect(transport);
      connection.transport = transport;
      connection.status = 'connected';
      connection.lastConnected = new Date();
      connection.error = undefined;

      console.log(`MCP 서버 연결 성공: ${config.name}`);
      return connection;

    } catch (error) {
      connection.status = 'error';
      
      // HTTP 오류 특별 처리 및 재시도
      if (error instanceof Error && (error.message.includes('HTTP 503') || error.message.includes('Rate Limited'))) {
        if (retryCount < 2) {
          // 3초 대기 후 재시도
          console.log(`Rate Limit 감지, ${3 * (retryCount + 1)}초 후 재시도... (${retryCount + 1}/3)`);
          await new Promise(resolve => setTimeout(resolve, 3000 * (retryCount + 1)));
          return this.connectToServer(config, retryCount + 1);
        } else {
          connection.error = '서버가 일시적으로 제한되었습니다. 잠시 후 다시 시도해주세요.';
        }
      } else if (error instanceof Error && error.message.includes('HTTP 401')) {
        connection.error = '인증이 필요합니다. API 키나 토큰이 필요할 수 있습니다.';
      } else if (error instanceof Error && error.message.includes('invalid_token')) {
        connection.error = '유효하지 않은 인증 토큰입니다. 올바른 API 키를 확인해주세요.';
      } else {
        connection.error = error instanceof Error ? error.message : '알 수 없는 오류';
      }
      
      console.error(`MCP 서버 연결 실패: ${config.name}`, error);
      throw error;
    }
  }

  async disconnectServer(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    try {
      if (connection.transport) {
        await connection.client.close();
      }
    } catch (error) {
      console.error(`MCP 서버 연결 해제 중 오류: ${connectionId}`, error);
    } finally {
      connection.status = 'disconnected';
      this.connections.delete(connectionId);
    }
  }

  getConnection(connectionId: string): MCPConnection | undefined {
    return this.connections.get(connectionId);
  }

  getAllConnections(): Map<string, MCPConnection> {
    return new Map(this.connections);
  }

  async listServerTools(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('서버가 연결되지 않았습니다');
    }

    try {
      return await connection.client.listTools();
    } catch (error) {
      console.error(`도구 목록 조회 실패: ${connectionId}`, error);
      throw error;
    }
  }

  async listServerResources(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('서버가 연결되지 않았습니다');
    }

    try {
      return await connection.client.listResources();
    } catch (error) {
      console.error(`리소스 목록 조회 실패: ${connectionId}`, error);
      throw error;
    }
  }

  async listServerPrompts(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('서버가 연결되지 않았습니다');
    }

    try {
      return await connection.client.listPrompts();
    } catch (error) {
      console.error(`프롬프트 목록 조회 실패: ${connectionId}`, error);
      throw error;
    }
  }

  async callTool(connectionId: string, toolName: string, arguments_: unknown) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('서버가 연결되지 않았습니다');
    }

    try {
      return await connection.client.callTool({
        name: toolName,
        arguments: arguments_ as { [x: string]: unknown }
      });
    } catch (error) {
      console.error(`도구 호출 실패: ${connectionId}`, error);
      throw error;
    }
  }

  async readResource(connectionId: string, uri: string) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('서버가 연결되지 않았습니다');
    }

    try {
      return await connection.client.readResource({ uri });
    } catch (error) {
      console.error(`리소스 읽기 실패: ${connectionId}`, error);
      throw error;
    }
  }

  async getPrompt(connectionId: string, promptName: string, arguments_: unknown) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('서버가 연결되지 않았습니다');
    }

    try {
      return await connection.client.getPrompt({
        name: promptName,
        arguments: arguments_ as { [x: string]: string }
      });
    } catch (error) {
      console.error(`프롬프트 가져오기 실패: ${connectionId}`, error);
      throw error;
    }
  }

  // 모든 연결 해제
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys()).map(
      connectionId => this.disconnectServer(connectionId)
    );
    
    await Promise.allSettled(disconnectPromises);
  }
}

// 싱글톤 인스턴스
export const mcpServerManager = new MCPServerManager();
