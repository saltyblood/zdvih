import { Alert } from 'react-native';

import { strings } from '../../strings';

export function confirmDialog({
  title,
  message,
  confirmLabel,
  destructive = false,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}): void {
  Alert.alert(title, message, [
    { text: strings.common.cancel, style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
