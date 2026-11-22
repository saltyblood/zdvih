import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '../repos/exerciseRepo';

export interface PickerSection {
  group: MuscleGroup;
  exercises: Exercise[];
}

/**
 * E1 grouping for the exercise picker: sections in MUSCLE_GROUPS order, exercises keep their
 * incoming order (exerciseService.list() order), filtered by a case-insensitive name search.
 * Sections without matches are omitted.
 */
export function pickerSections(exercises: Exercise[], query: string): PickerSection[] {
  const q = query.trim().toLowerCase();
  const matching = q ? exercises.filter((e) => e.name.toLowerCase().includes(q)) : exercises;
  return MUSCLE_GROUPS.map((group) => ({
    group,
    exercises: matching.filter((e) => e.muscle_group === group),
  })).filter((s) => s.exercises.length > 0);
}
