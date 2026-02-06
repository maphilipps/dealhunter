import { NextResponse } from 'next/server';

import { getToolsByCategory, listToolsForAgent, TOOL_CATEGORIES } from '@/lib/agent-tools';
import { buildAgentContext } from '@/lib/agent-tools/context-builder';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const toolsByCategory = getToolsByCategory();
    const allTools = listToolsForAgent();
    const userContext = await buildAgentContext(session.user.id);

    const categoriesWithLabels = Object.entries(toolsByCategory).map(([key, tools]) => ({
      id: key,
      label: TOOL_CATEGORIES[key as keyof typeof TOOL_CATEGORIES] || key,
      tools,
    }));

    const role = session.user.role || 'bd';
    const capabilities = {
      canCreateRfps: true,
      canViewRfps: true,
      canManageAccounts: true,
      canManageReferences: true,
      canManageCompetencies: true,
      canManageEmployees: role === 'admin' || role === 'bl',
      canManageTechnologies: role === 'admin',
      canManageBusinessUnits: role === 'admin',
      canManageUsers: role === 'admin',
      canAccessAdminPanel: role === 'admin',
      canReviewBids: role === 'bl' || role === 'admin',
      canViewProgress: true,
      canCheckTechnologyEol: true,
    };

    const agents = [
      {
        id: 'extraction',
        name: 'Extraction Agent',
        description:
          'Extrahiert strukturierte Daten aus Pre-Qualification-Dokumenten (PDF, E-Mail, Text)',
        status: 'active',
      },
      {
        id: 'qualification-scan',
        name: 'Qualification Agent',
        description:
          'Führt eine schnelle Erstbewertung durch und empfiehlt passende Business Lines',
        status: 'active',
      },
      {
        id: 'bit-evaluation',
        name: 'Bit Evaluation Agent',
        description:
          'Bewertet Pre-Qualifications mit BIT/NO BIT Entscheidung basierend auf strategischen Kriterien',
        status: 'active',
      },
      {
        id: 'team',
        name: 'Team Agent',
        description: 'Schlägt passende Team-Zusammensetzungen für Bid-Responses vor',
        status: 'active',
      },
    ];

    return NextResponse.json({
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role,
      },
      agents,
      tools: {
        total: allTools.length,
        byCategory: categoriesWithLabels,
      },
      capabilities,
      context: userContext,
    });
  } catch (error) {
    console.error('Error fetching capabilities:', error);
    return NextResponse.json({ error: 'Failed to fetch capabilities' }, { status: 500 });
  }
}
