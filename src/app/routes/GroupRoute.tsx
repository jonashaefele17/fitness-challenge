import { useActiveGroup } from '@/features/groups';
import { Card, Screen } from '@/shared/ui';

export function GroupRoute() {
  const { group } = useActiveGroup();

  return (
    <Screen title="Gruppe">
      <Card className="flex flex-col gap-1">
        <p className="text-title-3 font-semibold">{group.name}</p>
        <p className="text-subhead text-text-muted">
          Hier erscheinen bald der Feed, wer heute trainiert hat, und der Vergleich.
        </p>
      </Card>
    </Screen>
  );
}
