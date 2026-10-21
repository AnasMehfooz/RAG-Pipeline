import {useEffect} from 'react';
import {Demo} from './components/Demo';
import {Fixes, Footer, Header, Stack} from './components/Sections';
import {Story} from './components/Story';
import {useReducedMotion} from './hooks/useReducedMotion';
import {startScroll} from './lib/scroll';

export default function App() {
  const reduced = useReducedMotion();
  useEffect(() => startScroll(reduced), [reduced]);

  return (
    <>
      <Header />
      <main>
        <Story />
        <Demo />
        <Fixes />
        <Stack />
      </main>
      <Footer />
    </>
  );
}
