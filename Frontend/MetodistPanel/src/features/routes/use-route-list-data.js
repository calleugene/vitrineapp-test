import {useState} from 'react';
import {createLocalRouteRowsFromStorage, mergeLocalRouteRows} from '../../app/route-draft-utils';

import {mapRouteActivities, mapRouteRows, mapRouteSummaryData} from './mappers';

export function useRouteListData() {
  const [routeRows, setRouteRows] = useState([]);
  const [routeSummary, setRouteSummary] = useState(() => mapRouteSummaryData(null));
  const [routeActivities, setRouteActivities] = useState(() => mapRouteActivities(null));

  const applyRouteResults = ({routesResult, summaryResult, activityResult}) => {
    if (routesResult.status === 'fulfilled') {
      const mergedRoutes = mergeLocalRouteRows(routesResult.value.routes);
      setRouteRows(mapRouteRows(mergedRoutes));

      const localDraftCount = mergedRoutes.filter((item) => item.status === 'draft').length;
      setRouteSummary((prev) => ({
        ...prev,
        total: mergedRoutes.length,
        draft: localDraftCount,
      }));
    }

    if (summaryResult.status === 'fulfilled') {
      const mappedSummary = mapRouteSummaryData(summaryResult.value);
      const localDrafts = createLocalRouteRowsFromStorage();
      setRouteSummary({
        ...mappedSummary,
        total: mappedSummary.total + localDrafts.length,
        draft: mappedSummary.draft + localDrafts.length,
      });
    }

    if (activityResult.status === 'fulfilled') {
      setRouteActivities(mapRouteActivities(activityResult.value.activities));
    }
  };

  return {routeRows, routeSummary, routeActivities, applyRouteResults};
}

