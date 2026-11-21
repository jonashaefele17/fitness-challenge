import { Button, Card } from '@/shared/ui';
import { useDisablePush, useEnablePush, usePushStatus } from '../api/usePushSubscription';

const statusText = {
  on: 'Push-Mitteilungen sind auf diesem Gerät aktiv.',
  off: 'Erhalte Mitteilungen aufs Handy, auch wenn die App geschlossen ist.',
  denied:
    'Mitteilungen sind für diese App blockiert. Erlaube sie in den iPhone-Einstellungen unter Mitteilungen → Challenge.',
  'needs-install':
    'Push gibt es auf dem iPhone nur in der installierten App: In Safari teilen → „Zum Home-Bildschirm“, dann die App von dort öffnen.',
  unsupported: 'Auf diesem Gerät bzw. in diesem Browser sind keine Push-Mitteilungen möglich.',
  unconfigured: 'Push ist für diese Umgebung noch nicht eingerichtet.',
  supported: '',
} as const;

/** Turn push on/off for this device. */
export function PushSection() {
  const status = usePushStatus();
  const enable = useEnablePush();
  const disable = useDisablePush();
  const current = status.data ?? 'off';
  const failed = enable.isError || disable.isError;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-body font-semibold">Push auf diesem Gerät</p>
        <p className="text-footnote text-text-muted">
          {status.isPending ? 'Wird geprüft …' : statusText[current]}
        </p>
        {failed && (
          <p role="alert" className="text-footnote text-danger">
            Das hat nicht geklappt. Bitte versuch es noch einmal.
          </p>
        )}
      </div>
      {!status.isPending && current === 'off' && (
        <Button
          loading={enable.isPending}
          onClick={() => {
            // Ask for permission synchronously inside the tap (required on iOS).
            enable.mutate(Notification.requestPermission());
          }}
        >
          Push aktivieren
        </Button>
      )}
      {!status.isPending && current === 'on' && (
        <Button
          variant="secondary"
          loading={disable.isPending}
          onClick={() => {
            disable.mutate();
          }}
        >
          Push auf diesem Gerät ausschalten
        </Button>
      )}
    </Card>
  );
}
