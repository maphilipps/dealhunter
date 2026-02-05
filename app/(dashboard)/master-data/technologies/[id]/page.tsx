import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';

import { TechnologyDetail } from '@/components/admin/technology-detail';
import { getTechnology } from '@/lib/master-data/actions';
import { auth } from '@/lib/auth';

export default async function TechnologyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  if (session.user.role !== 'admin') {
    redirect('/');
  }

  const { id } = await params;
  const result = await getTechnology(id);

  if (!result.success || !result.technology) {
    notFound();
  }

  return <TechnologyDetail technology={result.technology} />;
}
