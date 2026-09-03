import { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";

import { reducer } from "./reducer.js";
import { emptyState } from "./schema.js";
import { loadState, saveState, clearState } from "./persistence.js";

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState() ?? emptyState());
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    setStorageAvailable(saveState(state));
  }, [state]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      storageAvailable,
      reset: () => {
        clearState();
        dispatch({ type: "reset" });
      }
    }),
    [state, storageAvailable]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}
