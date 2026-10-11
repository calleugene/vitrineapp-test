import {useState} from 'react';
import {filterMuseums} from '../utils.js';

/* Поиск по списку музеев: состояние запроса и отфильтрованный список.
   Фильтрация вынесена в utils, чтобы её можно было проверить отдельно. */
export function useMuseumSearch(museums) {
  const [query, setQuery] = useState('');

  return {
    query,
    setQuery,
    clear: () => setQuery(''),
    filtered: filterMuseums(museums, query),
  };
}
