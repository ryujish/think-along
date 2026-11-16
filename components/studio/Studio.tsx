'use client';

import dynamic from 'next/dynamic';
import './studio.css';

const App = dynamic(() => import('./App').then(module => module.App), {
  ssr: false,
  loading: () => <p role="status">생각 공간을 불러오고 있습니다.</p>,
});

export default function Studio() {
  return <App />;
}
