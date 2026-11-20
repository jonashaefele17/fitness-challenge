import { AppGate } from './AppGate';
import { Providers } from './providers';

export function App() {
  return (
    <Providers>
      <AppGate />
    </Providers>
  );
}
