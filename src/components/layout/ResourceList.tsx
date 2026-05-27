import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiListItem } from '../../types';
import { getItemSubtitle, getItemTitle } from '../../utils/format';
import { theme } from '../../theme/theme';
import { Card } from '../cards/Card';
import { EmptyState } from '../ui/EmptyState';

type ResourceListProps = {
  items: ApiListItem[];
  emptyTitle: string;
  emptyMessage?: string;
};

export function ResourceList({ items, emptyTitle, emptyMessage }: ResourceListProps) {
  if (!items.length) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <Card key={String(item.id || index)} style={styles.item}>
          <Text style={styles.title}>{getItemTitle(item)}</Text>
          {getItemSubtitle(item) ? <Text style={styles.subtitle}>{getItemSubtitle(item)}</Text> : null}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: theme.spacing.md,
  },
  item: {
    gap: 5,
    paddingVertical: theme.spacing.md,
  },
  title: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
});
