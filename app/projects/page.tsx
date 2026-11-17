import Workspace from '@/components/project/Workspace';
import Studio from '@/components/studio/Studio';
import ThinkAlong from '@/components/think/ThinkAlong';

export default async function ProjectsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.view === 'studio') return <Studio />;
  if (params.source || params.project || params.demo || (params.view && params.view !== 'director')) {
    return <Workspace />;
  }
  const sessionQuery = typeof params.session === 'string'
    ? params.session
    : typeof params.sessionId === 'string'
      ? params.sessionId
      : undefined;

  return (
    <ThinkAlong
      initialScreen={params.view === 'director' ? 'director' : undefined}
      initialSessionId={sessionQuery}
    />
  );
}
