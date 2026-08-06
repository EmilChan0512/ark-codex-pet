import type {
  CharacterDatabaseEntry,
} from "./types.js";

export function characterSearchHint(databasePath: string): string {
  return `Search the role name in ${databasePath} first.`;
}

export function formatCharacterSuggestion(entry: CharacterDatabaseEntry): string {
  return `${entry.name} (${entry.characterId})`;
}

export function buildCharacterNotFoundMessage(
  characterName: string,
  suggestions: CharacterDatabaseEntry[],
  databasePath: string,
): string {
  const suggestionText = suggestions.map(formatCharacterSuggestion).join(", ");
  return suggestionText
    ? `Character not found: ${characterName}. Suggestions: ${suggestionText}. ${characterSearchHint(databasePath)}`
    : `Character not found: ${characterName}. ${characterSearchHint(databasePath)}`;
}

export function buildCharacterAmbiguousMessage(
  matches: CharacterDatabaseEntry[],
  databasePath: string,
): string {
  return `Character query is ambiguous: ${matches
    .map(formatCharacterSuggestion)
    .join(", ")}. ${characterSearchHint(databasePath)}`;
}
