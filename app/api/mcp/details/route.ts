import { NextRequest, NextResponse } from 'next/server';
import { mcpServerManager } from '../../../../lib/mcp-server';

export async function POST(request: NextRequest) {
  try {
    const { connectionId } = await request.json();

    if (!connectionId) {
      return NextResponse.json(
        { error: '연결 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const [tools, resources, prompts] = await Promise.all([
      mcpServerManager.listServerTools(connectionId),
      mcpServerManager.listServerResources(connectionId),
      mcpServerManager.listServerPrompts(connectionId)
    ]);

    return NextResponse.json({
      success: true,
      details: {
        tools: tools.tools || [],
        resources: resources.resources || [],
        prompts: prompts.prompts || []
      }
    });

  } catch (error) {
    console.error('MCP 서버 세부 정보 조회 실패:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : '서버 세부 정보 조회에 실패했습니다',
        success: false 
      },
      { status: 500 }
    );
  }
}
