'use client';
import { House, Clock3, Lightbulb, User } from 'lucide-react';
export default function BottomNavigation(){
const items = [['Think', House], ['Journey', Clock3], ['Insight', Lightbulb], ['Profile', User]] as const;
return <nav className="fixed bottom-0 inset-x-0 border-t bg-white"><div className="mx-auto flex max-w-4xl justify-around py-3">{items.map(([t, Icon]) => <button key={t} className="flex flex-col items-center gap-1 text-xs"><Icon size={20} />{t}</button>)}</div></nav>;
}
