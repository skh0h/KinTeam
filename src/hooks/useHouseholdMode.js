import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useHouseholdMode() {
  const queryClient = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: ['household-settings'],
    queryFn: () => base44.entities.HouseholdSettings.list(),
  });

  const record = settings[0];
  const mode = record?.mode || 'normal';

  const mutation = useMutation({
    mutationFn: async (newMode) => {
      if (record) {
        await base44.entities.HouseholdSettings.update(record.id, { mode: newMode, auto_set: false });
      } else {
        await base44.entities.HouseholdSettings.create({ mode: newMode, auto_set: false });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household-settings'] }),
  });

  return { mode, setMode: (m) => mutation.mutate(m), isSaving: mutation.isPending };
}