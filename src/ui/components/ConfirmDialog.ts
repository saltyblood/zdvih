import { Alert } from 'react-native';

import { strings } from '../../strings';

export function confirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}): void {
  Alert.alert(title, message, [
    { text: strings.workout.cancel, style: 'cancel' },
    { text: confirmLabel, onPress: onConfirm },
  ]);
}
