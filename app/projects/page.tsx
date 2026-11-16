import Workspace from '@/components/project/Workspace';
import Studio from '@/components/studio/Studio';

export default async function ProjectsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return params.source || params.project || params.demo || params.view
    ? <Workspace />
    : <Studio />;
}
