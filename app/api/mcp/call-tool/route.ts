import { NextRequest, NextResponse } from 'next/server';
import { mcpServerManager } from '../../../../lib/mcp-server';

export async function POST(request: NextRequest) {
  try {
    const { connectionId, toolName, arguments: toolArgs } = await request.json();

    if (!connectionId || !toolName) {
      return NextResponse.json(
        { error: '연결 ID와 도구 이름이 필요합니다' },
        { status: 400 }
      );
    }

    const result = await mcpServerManager.callTool(connectionId, toolName, toolArgs || {});
    
    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('도구 호출 실패:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : '도구 호출에 실패했습니다',
        success: false 
      },
      { status: 500 }
    );
  }
}
