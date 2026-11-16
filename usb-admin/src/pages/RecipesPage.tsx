import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { API_URL } from "../config";
import "../recipes.css";

type RecipeType = "PREPARATION" | "MENU_ITEM" | "BOWL_COMPONENT";
type VersionStatus = "DRAFT" | "PUBLISHED" | "SUPERSEDED" | "ARCHIVED";

type Unit = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  dimension: string;
  isActive: boolean;
};

type Ingredient = {
  id: string;
  code: string;
  name: string;
  baseUnitId: string;
  baseUnit: Unit;
  isActive: boolean;
};

type VersionSummary = {
  id: string;
  versionNumber: number;
  status: VersionStatus;
  outputQuantity: string;
  outputUnitCodeSnapshot: string;
  publishedAt: string | null;
};

type IngredientLine = {
  id: string;
  ingredientId: string;
  quantity: string;
  ingredientNameSnapshot: string;
  ingredientCodeSnapshot: string;
  unitSymbolSnapshot: string;
  sortOrder: number;
  notes: string | null;
  ingredient: Ingredient;
  unit: Unit;
};

type SubrecipeLine = {
  id: string;
  componentRecipeVersionId: string;
  quantity: string;
  componentRecipeCodeSnapshot: string;
  componentRecipeNameSnapshot: string;
  componentVersionNumberSnapshot: number;
  componentOutputUnitSymbolSnapshot: string;
  sortOrder: number;
  notes: string | null;
  componentRecipeVersion: {
    id: string;
    versionNumber: number;
    status: VersionStatus;
    recipe: { id: string; code: string; name: string };
    outputUnit: Unit;
  };
};

type RecipeStep = {
  id: string;
  stepNumber: number;
  title: string | null;
  instruction: string;
  timerSeconds: number | null;
};

type RecipeVersion = {
  id: string;
  versionNumber: number;
  status: VersionStatus;
  recipeCodeSnapshot: string;
  recipeNameSnapshot: string;
  recipeTypeSnapshot: RecipeType;
  outputQuantity: string;
  outputUnitId: string;
  outputUnitCodeSnapshot: string;
  outputUnitNameSnapshot: string;
  outputUnitSymbolSnapshot: string;
  yieldNotes: string | null;
  changeSummary: string | null;
  publishedAt: string | null;
  outputUnit: Unit;
  ingredientLines: IngredientLine[];
  subrecipeLines: SubrecipeLine[];
  steps: RecipeStep[];
};

type RecipeSummary = {
  id: string;
  code: string;
  name: string;
  recipeType: RecipeType;
  description: string | null;
  isActive: boolean;
  versions: VersionSummary[];
  _count?: { versions: number };
};

type RecipeDetail = Omit<RecipeSummary, "versions"> & {
  versions: RecipeVersion[];
};

type DraftStep = {
  stepNumber: number;
  title: string;
  instruction: string;
  timerSeconds: string;
};

type Props = {
  accessToken: string;
  signedInEmail: string;
  onBackToOrders: () => void;
  onSignOut: () => Promise<void>;
};

type NewRecipeForm = {
  code: string;
  name: string;
  recipeType: RecipeType;
  description: string;
  outputQuantity: string;
  outputUnitId: string;
  yieldNotes: string;
  changeSummary: string;
};

const blankRecipe: NewRecipeForm = {
  code: "",
  name: "",
  recipeType: "PREPARATION",
  description: "",
  outputQuantity: "",
  outputUnitId: "",
  yieldNotes: "",
  changeSummary: "",
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

async function apiRequest<T>(
  path: string,
  accessToken: string,
  onSignOut: () => Promise<void>,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  const raw = await response.text();
  let payload: unknown = null;

  if (raw) {
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      payload = null;
    }
  }

  if (response.status === 401) {
    await onSignOut();
    throw new Error("Your session expired. Please sign in again.");
  }

  if (response.status === 403) {
    throw new Error("This account is not authorised for Recipe Studio.");
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status}).`;

    throw new Error(message);
  }

  return payload as T;
}

function statusLabel(status?: VersionStatus): string {
  if (!status) return "Not started";
  return status.replaceAll("_", " ");
}

export default function RecipesPage({
  accessToken,
  signedInEmail,
  onBackToOrders,
  onSignOut,
}: Props) {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeDetail | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(false);
  const [recipeDetailsForm, setRecipeDetailsForm] = useState({ name: "", description: "" });

  const [showCreate, setShowCreate] = useState(false);
  const [newRecipe, setNewRecipe] = useState<NewRecipeForm>(blankRecipe);

  const [draftForm, setDraftForm] = useState({
    outputQuantity: "",
    outputUnitId: "",
    yieldNotes: "",
    changeSummary: "",
  });

  const [ingredientId, setIngredientId] = useState("");
  const [ingredientQuantity, setIngredientQuantity] = useState("");
  const [ingredientNotes, setIngredientNotes] = useState("");

  const [candidateRecipeId, setCandidateRecipeId] = useState("");
  const [candidateVersions, setCandidateVersions] = useState<RecipeVersion[]>([]);
  const [candidateVersionId, setCandidateVersionId] = useState("");
  const [subrecipeQuantity, setSubrecipeQuantity] = useState("");
  const [subrecipeNotes, setSubrecipeNotes] = useState("");

  const [steps, setSteps] = useState<DraftStep[]>([]);

  const selectedVersion = useMemo(
    () =>
      selectedRecipe?.versions.find((version) => version.id === selectedVersionId) ??
      selectedRecipe?.versions[0] ??
      null,
    [selectedRecipe, selectedVersionId],
  );

  const editable = selectedRecipe?.isActive === true && selectedVersion?.status === "DRAFT";
  const existingDraft = selectedRecipe?.versions.some(
    (version) => version.status === "DRAFT",
  ) ?? false;

  const filteredRecipes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return recipes;

    return recipes.filter(
      (recipe) =>
        recipe.name.toLowerCase().includes(query) ||
        recipe.code.toLowerCase().includes(query),
    );
  }, [recipes, search]);

  const loadRecipe = useCallback(
    async (recipeId: string, preferredVersionId?: string) => {
      const detail = await apiRequest<RecipeDetail>(
        `/recipes/${encodeURIComponent(recipeId)}`,
        accessToken,
        onSignOut,
      );

      setSelectedRecipe(detail);

      const preferred = detail.versions.find(
        (version) => version.id === preferredVersionId,
      );
      const draft = detail.versions.find(
        (version) => version.status === "DRAFT",
      );

      setSelectedVersionId(
        preferred?.id ?? draft?.id ?? detail.versions[0]?.id ?? "",
      );

      return detail;
    },
    [accessToken, onSignOut],
  );

  const loadCatalogue = useCallback(
    async (preferredRecipeId?: string, includeArchived = false) => {
      setLoading(true);
      setError("");

      try {
        const [recipeRows, ingredientRows, unitRows] = await Promise.all([
          apiRequest<RecipeSummary[]>(
            `/recipes${includeArchived ? "?includeInactive=true" : ""}`,
            accessToken,
            onSignOut,
          ),
          apiRequest<Ingredient[]>(
            "/ingredients",
            accessToken,
            onSignOut,
          ),
          apiRequest<Unit[]>(
            "/units",
            accessToken,
            onSignOut,
          ),
        ]);

        setRecipes(recipeRows);
        setIngredients(ingredientRows);
        setUnits(unitRows);

        const recipeId =
          recipeRows.find((recipe) => recipe.id === preferredRecipeId)?.id ??
          recipeRows.find((recipe) => recipe.isActive)?.id ??
          recipeRows[0]?.id;

        if (recipeId) {
          await loadRecipe(recipeId);
        } else {
          setSelectedRecipe(null);
          setSelectedVersionId("");
        }
      } catch (loadError) {
        setError(errorMessage(loadError));
      } finally {
        setLoading(false);
      }
    },
    [accessToken, onSignOut, loadRecipe],
  );

  useEffect(() => {
    void loadCatalogue();
  }, [loadCatalogue]);

  useEffect(() => {
    if (!selectedVersion) return;

    setDraftForm({
      outputQuantity: String(selectedVersion.outputQuantity),
      outputUnitId: selectedVersion.outputUnitId,
      yieldNotes: selectedVersion.yieldNotes ?? "",
      changeSummary: selectedVersion.changeSummary ?? "",
    });

    setSteps(
      selectedVersion.steps.map((step) => ({
        stepNumber: step.stepNumber,
        title: step.title ?? "",
        instruction: step.instruction,
        timerSeconds:
          step.timerSeconds === null ? "" : String(step.timerSeconds),
      })),
    );
  }, [selectedVersion]);

  async function perform(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await action();
      setNotice(message);
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await perform(async () => {
      const created = await apiRequest<RecipeDetail>(
        "/recipes",
        accessToken,
        onSignOut,
        {
          method: "POST",
          body: JSON.stringify({
            ...newRecipe,
            description: newRecipe.description || null,
            yieldNotes: newRecipe.yieldNotes || null,
            changeSummary: newRecipe.changeSummary || null,
          }),
        },
      );

      setNewRecipe(blankRecipe);
      setShowCreate(false);
      await loadCatalogue(created.id, showArchived);
    }, "Recipe created as a draft.");
  }

  async function handleCreateDraft() {
    if (!selectedRecipe) return;

    await perform(async () => {
      const created = await apiRequest<RecipeVersion>(
        `/recipes/${encodeURIComponent(selectedRecipe.id)}/versions`,
        accessToken,
        onSignOut,
        {
          method: "POST",
          body: JSON.stringify({
            changeSummary: "New draft version",
          }),
        },
      );

      await loadRecipe(selectedRecipe.id, created.id);
      await loadCatalogue(selectedRecipe.id, showArchived);
    }, "New draft version created.");
  }

  async function handleSaveVersion() {
    if (!selectedRecipe || !selectedVersion) return;

    await perform(async () => {
      await apiRequest<RecipeVersion>(
        `/recipes/${encodeURIComponent(selectedRecipe.id)}/versions/${encodeURIComponent(selectedVersion.id)}`,
        accessToken,
        onSignOut,
        {
          method: "PATCH",
          body: JSON.stringify({
            outputQuantity: draftForm.outputQuantity,
            outputUnitId: draftForm.outputUnitId,
            yieldNotes: draftForm.yieldNotes || null,
            changeSummary: draftForm.changeSummary || null,
          }),
        },
      );

      await loadRecipe(selectedRecipe.id, selectedVersion.id);
    }, "Draft version details saved.");
  }

  async function handleAddIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRecipe || !selectedVersion) return;

    await perform(async () => {
      await apiRequest(
        `/recipes/${encodeURIComponent(selectedRecipe.id)}/versions/${encodeURIComponent(selectedVersion.id)}/ingredients`,
        accessToken,
        onSignOut,
        {
          method: "POST",
          body: JSON.stringify({
            ingredientId,
            quantity: ingredientQuantity,
            notes: ingredientNotes || null,
          }),
        },
      );

      setIngredientQuantity("");
      setIngredientNotes("");
      await loadRecipe(selectedRecipe.id, selectedVersion.id);
    }, "Ingredient added using its base unit.");
  }

  async function handleRemoveIngredient(lineId: string) {
    if (!selectedRecipe || !selectedVersion) return;

    await perform(async () => {
      await apiRequest(
        `/recipes/${encodeURIComponent(selectedRecipe.id)}/versions/${encodeURIComponent(selectedVersion.id)}/ingredients/${encodeURIComponent(lineId)}`,
        accessToken,
        onSignOut,
        { method: "DELETE" },
      );

      await loadRecipe(selectedRecipe.id, selectedVersion.id);
    }, "Ingredient removed from draft.");
  }

  async function handleCandidateRecipeChange(recipeId: string) {
    setCandidateRecipeId(recipeId);
    setCandidateVersions([]);
    setCandidateVersionId("");

    if (!recipeId) return;

    try {
      const detail = await apiRequest<RecipeDetail>(
        `/recipes/${encodeURIComponent(recipeId)}`,
        accessToken,
        onSignOut,
      );

      setCandidateVersions(
        detail.versions.filter(
          (version) =>
            version.status === "PUBLISHED" ||
            version.status === "SUPERSEDED",
        ),
      );
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }

  async function handleAddSubrecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRecipe || !selectedVersion) return;

    await perform(async () => {
      await apiRequest(
        `/recipes/${encodeURIComponent(selectedRecipe.id)}/versions/${encodeURIComponent(selectedVersion.id)}/subrecipes`,
        accessToken,
        onSignOut,
        {
          method: "POST",
          body: JSON.stringify({
            componentRecipeVersionId: candidateVersionId,
            quantity: subrecipeQuantity,
            notes: subrecipeNotes || null,
          }),
        },
      );

      setSubrecipeQuantity("");
      setSubrecipeNotes("");
      await loadRecipe(selectedRecipe.id, selectedVersion.id);
    }, "Published sub-recipe version added.");
  }

  async function handleRemoveSubrecipe(lineId: string) {
    if (!selectedRecipe || !selectedVersion) return;

    await perform(async () => {
      await apiRequest(
        `/recipes/${encodeURIComponent(selectedRecipe.id)}/versions/${encodeURIComponent(selectedVersion.id)}/subrecipes/${encodeURIComponent(lineId)}`,
        accessToken,
        onSignOut,
        { method: "DELETE" },
      );

      await loadRecipe(selectedRecipe.id, selectedVersion.id);
    }, "Sub-recipe removed from draft.");
  }

  async function handleSaveSteps() {
    if (!selectedRecipe || !selectedVersion) return;

    await perform(async () => {
      await apiRequest(
        `/recipes/${encodeURIComponent(selectedRecipe.id)}/versions/${encodeURIComponent(selectedVersion.id)}/steps`,
        accessToken,
        onSignOut,
        {
          method: "PUT",
          body: JSON.stringify({
            steps: steps.map((step) => ({
              stepNumber: step.stepNumber,
              title: step.title || null,
              instruction: step.instruction,
              timerSeconds:
                step.timerSeconds.trim() === ""
                  ? null
                  : Number(step.timerSeconds),
            })),
          }),
        },
      );

      await loadRecipe(selectedRecipe.id, selectedVersion.id);
    }, "Preparation steps saved.");
  }

  async function handlePublish() {
    if (!selectedRecipe || !selectedVersion) return;

    await perform(async () => {
      await apiRequest(
        `/recipes/${encodeURIComponent(selectedRecipe.id)}/versions/${encodeURIComponent(selectedVersion.id)}/publish`,
        accessToken,
        onSignOut,
        { method: "POST", body: "{}" },
      );

      await loadCatalogue(selectedRecipe.id, showArchived);
    }, "Recipe version published successfully.");
  }

  function beginEditRecipe() {
    if (!selectedRecipe || !selectedRecipe.isActive) return;
    setRecipeDetailsForm({
      name: selectedRecipe.name,
      description: selectedRecipe.description ?? "",
    });
    setEditingRecipe(true);
    setError("");
    setNotice("");
  }

  async function handleSaveRecipeDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRecipe) return;

    await perform(async () => {
      await apiRequest(
        `/recipes/${encodeURIComponent(selectedRecipe.id)}`,
        accessToken,
        onSignOut,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: recipeDetailsForm.name,
            description: recipeDetailsForm.description.trim() || null,
          }),
        },
      );

      setEditingRecipe(false);
      await loadCatalogue(selectedRecipe.id, showArchived);
    }, "Recipe details updated. Published version history remains unchanged.");
  }

  async function handleArchiveDraft() {
    if (!selectedRecipe || !selectedVersion || selectedVersion.status !== "DRAFT") return;

    const confirmed = window.confirm(
      `Archive draft v${selectedVersion.versionNumber}? It will remain in version history but can no longer be edited or published.`,
    );
    if (!confirmed) return;

    await perform(async () => {
      await apiRequest(
        `/recipes/${encodeURIComponent(selectedRecipe.id)}/versions/${encodeURIComponent(selectedVersion.id)}/archive`,
        accessToken,
        onSignOut,
        { method: "POST", body: "{}" },
      );

      await loadCatalogue(selectedRecipe.id, showArchived);
    }, "Draft version archived and retained in history.");
  }

  async function handleArchiveRecipe() {
    if (!selectedRecipe || !selectedRecipe.isActive || existingDraft) return;

    const confirmed = window.confirm(
      `Archive ${selectedRecipe.name}? It will be hidden from the active catalogue. Its version history and published snapshots will be retained.`,
    );
    if (!confirmed) return;

    await perform(async () => {
      await apiRequest(
        `/recipes/${encodeURIComponent(selectedRecipe.id)}/archive`,
        accessToken,
        onSignOut,
        { method: "POST", body: "{}" },
      );

      setEditingRecipe(false);
      await loadCatalogue(showArchived ? selectedRecipe.id : undefined, showArchived);
    }, "Recipe archived. Its history has been retained.");
  }

  async function handleRestoreRecipe() {
    if (!selectedRecipe || selectedRecipe.isActive) return;

    await perform(async () => {
      await apiRequest(
        `/recipes/${encodeURIComponent(selectedRecipe.id)}/restore`,
        accessToken,
        onSignOut,
        { method: "POST", body: "{}" },
      );

      await loadCatalogue(selectedRecipe.id, showArchived);
    }, "Recipe restored to the active catalogue.");
  }

  function handleShowArchivedChange(checked: boolean) {
    setShowArchived(checked);
    setEditingRecipe(false);
    void loadCatalogue(selectedRecipe?.id, checked);
  }

  function updateStep(index: number, field: keyof DraftStep, value: string) {
    setSteps((current) =>
      current.map((step, stepIndex) =>
        stepIndex === index ? { ...step, [field]: value } : step,
      ),
    );
  }

  function addStep() {
    setSteps((current) => [
      ...current,
      {
        stepNumber: current.length + 1,
        title: "",
        instruction: "",
        timerSeconds: "",
      },
    ]);
  }

  function removeStep(index: number) {
    setSteps((current) =>
      current
        .filter((_, stepIndex) => stepIndex !== index)
        .map((step, stepIndex) => ({
          ...step,
          stepNumber: stepIndex + 1,
        })),
    );
  }

  return (
    <main className="recipes-shell">
      <header className="recipes-topbar">
        <div className="recipes-brand">
          <button className="recipe-button recipe-button-quiet" onClick={onBackToOrders}>
            ← Orders
          </button>
          <div>
            <div className="recipe-eyebrow">UNDERGROUND · KITCHEN OS</div>
            <h1>Recipe Studio</h1>
            <p>Preparation recipes, menu items and bowl components</p>
          </div>
        </div>

        <div className="recipes-account">
          <span>{signedInEmail}</span>
          <button className="recipe-button recipe-button-quiet" onClick={() => void onSignOut()}>
            Sign out
          </button>
        </div>
      </header>

      {error && <div className="recipe-alert recipe-alert-error" role="alert">{error}</div>}
      {notice && <div className="recipe-alert recipe-alert-success" role="status">{notice}</div>}

      <div className="recipes-layout">
        <aside className="recipes-sidebar">
          <div className="recipes-sidebar-head">
            <div>
              <h2>Recipes</h2>
              <span>{recipes.length} {showArchived ? "shown" : "active"}</span>
            </div>
            <button
              className="recipe-button recipe-button-primary"
              onClick={() => setShowCreate((value) => !value)}
            >
              + New
            </button>
          </div>

          <input
            className="recipe-input recipe-search"
            placeholder="Search recipes..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <label className="recipe-archived-toggle">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => handleShowArchivedChange(event.target.checked)}
            />
            <span>Show archived recipes</span>
          </label>

          {showCreate && (
            <form className="recipe-card recipe-create-form" onSubmit={handleCreateRecipe}>
              <h3>New recipe</h3>

              <label>
                Recipe code
                <input
                  className="recipe-input"
                  required
                  maxLength={64}
                  value={newRecipe.code}
                  onChange={(event) => setNewRecipe({ ...newRecipe, code: event.target.value })}
                  placeholder="PREP_RICE"
                />
              </label>

              <label>
                Recipe name
                <input
                  className="recipe-input"
                  required
                  maxLength={160}
                  value={newRecipe.name}
                  onChange={(event) => setNewRecipe({ ...newRecipe, name: event.target.value })}
                  placeholder="Cooked rice"
                />
              </label>

              <label>
                Type
                <select
                  className="recipe-input"
                  value={newRecipe.recipeType}
                  onChange={(event) => setNewRecipe({ ...newRecipe, recipeType: event.target.value as RecipeType })}
                >
                  <option value="PREPARATION">Preparation</option>
                  <option value="MENU_ITEM">Menu item</option>
                  <option value="BOWL_COMPONENT">Bowl component</option>
                </select>
              </label>

              <label>
                Description
                <textarea
                  className="recipe-input"
                  rows={2}
                  value={newRecipe.description}
                  onChange={(event) => setNewRecipe({ ...newRecipe, description: event.target.value })}
                />
              </label>

              <label>
                Expected output quantity
                <input
                  className="recipe-input"
                  required
                  inputMode="decimal"
                  value={newRecipe.outputQuantity}
                  onChange={(event) => setNewRecipe({ ...newRecipe, outputQuantity: event.target.value })}
                  placeholder="Enter measured output"
                />
              </label>

              <label>
                Output unit
                <select
                  className="recipe-input"
                  required
                  value={newRecipe.outputUnitId}
                  onChange={(event) => setNewRecipe({ ...newRecipe, outputUnitId: event.target.value })}
                >
                  <option value="">Select unit</option>
                  {units.filter((unit) => unit.isActive).map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.symbol})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Yield notes
                <textarea
                  className="recipe-input"
                  rows={2}
                  value={newRecipe.yieldNotes}
                  onChange={(event) => setNewRecipe({ ...newRecipe, yieldNotes: event.target.value })}
                  placeholder="Optional measured yield notes"
                />
              </label>

              <label>
                Change summary
                <textarea
                  className="recipe-input"
                  rows={2}
                  value={newRecipe.changeSummary}
                  onChange={(event) => setNewRecipe({ ...newRecipe, changeSummary: event.target.value })}
                />
              </label>

              <div className="recipe-form-actions">
                <button type="button" className="recipe-button recipe-button-quiet" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="recipe-button recipe-button-primary" disabled={busy || units.length === 0}>
                  Create draft
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <p className="recipe-muted">Loading recipes...</p>
          ) : filteredRecipes.length === 0 ? (
            <div className="recipe-empty">
              <strong>{search.trim() ? "No matching recipes" : showArchived ? "No recipes yet" : "No active recipes"}</strong>
              <p>{search.trim() ? "Try another name or recipe code." : showArchived ? "Create your first preparation recipe or menu item." : "Turn on Show archived recipes to view archived records."}</p>
            </div>
          ) : (
            <div className="recipe-list">
              {filteredRecipes.map((recipe) => {
                const latest = recipe.versions[0];
                return (
                  <button
                    key={recipe.id}
                    className={`recipe-list-item ${selectedRecipe?.id === recipe.id ? "is-selected" : ""}`}
                    onClick={() => {
                      setEditingRecipe(false);
                      void loadRecipe(recipe.id).catch((loadError) => setError(errorMessage(loadError)));
                    }}
                  >
                    <span className="recipe-list-name">{recipe.name}</span>
                    <span className="recipe-list-meta">{recipe.code} · {recipe.recipeType.replaceAll("_", " ")}</span>
                    <span className={`recipe-status recipe-status-${(recipe.isActive ? latest?.status ?? "DRAFT" : "ARCHIVED").toLowerCase()}`}>
                      {!recipe.isActive
                        ? "RECIPE ARCHIVED"
                        : latest?.status === "ARCHIVED"
                          ? "DRAFT ARCHIVED"
                          : statusLabel(latest?.status)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <button className="recipe-button recipe-button-quiet recipe-refresh" onClick={() => void loadCatalogue(selectedRecipe?.id, showArchived)}>
            ↻ Refresh catalogue
          </button>
        </aside>

        <section className="recipes-detail">
          {!selectedRecipe || !selectedVersion ? (
            <div className="recipe-detail-empty">
              <span className="recipe-empty-symbol">R</span>
              <h2>Select a recipe</h2>
              <p>Choose a recipe from the left, or create a new one.</p>
            </div>
          ) : (
            <>
              <div className="recipe-detail-header">
                <div>
                  <div className="recipe-eyebrow">{selectedRecipe.code} · {selectedRecipe.recipeType.replaceAll("_", " ")}</div>
                  <h2>{selectedRecipe.name}</h2>
                  <p>{selectedRecipe.description || "No recipe description added."}</p>
                </div>
                <div className="recipe-detail-actions">
                  <span className={`recipe-status recipe-status-${selectedRecipe.isActive ? selectedVersion.status.toLowerCase() : "archived"}`}>
                    {!selectedRecipe.isActive
                      ? "RECIPE ARCHIVED"
                      : selectedVersion.status === "ARCHIVED"
                        ? "ARCHIVED DRAFT"
                        : statusLabel(selectedVersion.status)}
                  </span>
                  {selectedRecipe.isActive ? (
                    <>
                      <button className="recipe-button recipe-button-quiet" disabled={busy} onClick={beginEditRecipe}>
                        Edit details
                      </button>
                      <button
                        className="recipe-button recipe-button-danger-quiet"
                        disabled={busy || existingDraft}
                        title={existingDraft ? "Archive or publish the unfinished draft first." : "Archive this recipe"}
                        onClick={() => void handleArchiveRecipe()}
                      >
                        Archive recipe
                      </button>
                      {!existingDraft && (
                        <button className="recipe-button recipe-button-secondary" disabled={busy} onClick={() => void handleCreateDraft()}>
                          + New version
                        </button>
                      )}
                    </>
                  ) : (
                    <button className="recipe-button recipe-button-secondary" disabled={busy} onClick={() => void handleRestoreRecipe()}>
                      Restore recipe
                    </button>
                  )}
                </div>
              </div>

              {selectedRecipe.isActive && existingDraft && (
                <p className="recipe-lifecycle-hint">Archive or publish the unfinished draft before archiving this recipe.</p>
              )}

              {editingRecipe && selectedRecipe.isActive && (
                <form className="recipe-card recipe-details-edit-form" onSubmit={handleSaveRecipeDetails}>
                  <div className="recipe-section-heading">
                    <div>
                      <h3>Edit recipe details</h3>
                      <p>Changes update the current recipe identity. Published version snapshots stay unchanged.</p>
                    </div>
                  </div>
                  <div className="recipe-form-grid">
                    <label>
                      Recipe name
                      <input
                        className="recipe-input"
                        required
                        maxLength={160}
                        value={recipeDetailsForm.name}
                        onChange={(event) => setRecipeDetailsForm({ ...recipeDetailsForm, name: event.target.value })}
                      />
                    </label>
                    <label className="recipe-grid-wide">
                      Description
                      <textarea
                        className="recipe-input"
                        rows={3}
                        maxLength={10000}
                        value={recipeDetailsForm.description}
                        onChange={(event) => setRecipeDetailsForm({ ...recipeDetailsForm, description: event.target.value })}
                      />
                    </label>
                  </div>
                  <div className="recipe-form-actions">
                    <button type="button" className="recipe-button recipe-button-quiet" disabled={busy} onClick={() => setEditingRecipe(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="recipe-button recipe-button-primary" disabled={busy || !recipeDetailsForm.name.trim()}>
                      Save details
                    </button>
                  </div>
                </form>
              )}

              <div className="recipe-version-bar">
                <label>
                  Version history
                  <select
                    className="recipe-input recipe-version-select"
                    value={selectedVersionId}
                    onChange={(event) => setSelectedVersionId(event.target.value)}
                  >
                    {selectedRecipe.versions.map((version) => (
                      <option key={version.id} value={version.id}>
                        v{version.versionNumber} · {statusLabel(version.status)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="recipe-version-actions">
                  <div className="recipe-version-meta">
                    {selectedVersion.publishedAt
                      ? `Published ${new Date(selectedVersion.publishedAt).toLocaleString()}`
                      : selectedVersion.status === "ARCHIVED"
                        ? "Archived draft · retained in history"
                        : "Not published"}
                  </div>
                  {selectedRecipe.isActive && selectedVersion.status === "DRAFT" && (
                    <button className="recipe-button recipe-button-danger-quiet" disabled={busy} onClick={() => void handleArchiveDraft()}>
                      Archive draft
                    </button>
                  )}
                </div>
              </div>

              <div className="recipe-card recipe-yield-card">
                <div className="recipe-section-heading">
                  <div>
                    <h3>Batch output & yield</h3>
                    <p>Record the actual expected output from one preparation batch.</p>
                  </div>
                  {editable && <span className="recipe-editable-label">Draft editable</span>}
                </div>

                <div className="recipe-form-grid">
                  <label>
                    Output quantity
                    <input
                      className="recipe-input"
                      inputMode="decimal"
                      disabled={!editable}
                      value={draftForm.outputQuantity}
                      onChange={(event) => setDraftForm({ ...draftForm, outputQuantity: event.target.value })}
                    />
                  </label>

                  <label>
                    Output unit
                    <select
                      className="recipe-input"
                      disabled={!editable}
                      value={draftForm.outputUnitId}
                      onChange={(event) => setDraftForm({ ...draftForm, outputUnitId: event.target.value })}
                    >
                      {units.filter((unit) => unit.isActive).map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name} ({unit.symbol})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="recipe-grid-wide">
                    Yield notes
                    <textarea
                      className="recipe-input"
                      rows={2}
                      disabled={!editable}
                      value={draftForm.yieldNotes}
                      onChange={(event) => setDraftForm({ ...draftForm, yieldNotes: event.target.value })}
                      placeholder="Record measured output, trimming or cooking loss."
                    />
                  </label>

                  <label className="recipe-grid-wide">
                    Version change summary
                    <textarea
                      className="recipe-input"
                      rows={2}
                      disabled={!editable}
                      value={draftForm.changeSummary}
                      onChange={(event) => setDraftForm({ ...draftForm, changeSummary: event.target.value })}
                    />
                  </label>
                </div>

                {editable && (
                  <div className="recipe-form-actions">
                    <button className="recipe-button recipe-button-secondary" disabled={busy} onClick={() => void handleSaveVersion()}>
                      Save batch details
                    </button>
                  </div>
                )}
              </div>

              <div className="recipe-card">
                <div className="recipe-section-heading">
                  <div>
                    <h3>Ingredients</h3>
                    <p>Quantities are always entered in each ingredient's base unit.</p>
                  </div>
                  <span className="recipe-count">{selectedVersion.ingredientLines.length} lines</span>
                </div>

                {selectedVersion.ingredientLines.length === 0 ? (
                  <p className="recipe-muted">No ingredients added to this version.</p>
                ) : (
                  <div className="recipe-line-list">
                    {selectedVersion.ingredientLines.map((line) => (
                      <div className="recipe-line" key={line.id}>
                        <div>
                          <strong>{line.ingredientNameSnapshot}</strong>
                          <small>{line.ingredientCodeSnapshot}</small>
                        </div>
                        <strong className="recipe-quantity">{line.quantity} {line.unitSymbolSnapshot}</strong>
                        {editable && (
                          <button className="recipe-icon-button" title="Remove ingredient" disabled={busy} onClick={() => void handleRemoveIngredient(line.id)}>
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {editable && (
                  <form className="recipe-inline-form" onSubmit={handleAddIngredient}>
                    <label>
                      Ingredient
                      <select className="recipe-input" required value={ingredientId} onChange={(event) => setIngredientId(event.target.value)}>
                        <option value="">Select ingredient</option>
                        {ingredients.filter((item) => item.isActive).map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} · {item.baseUnit.symbol}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Quantity in base unit
                      <input className="recipe-input" required inputMode="decimal" value={ingredientQuantity} onChange={(event) => setIngredientQuantity(event.target.value)} placeholder="Measured amount" />
                    </label>
                    <label>
                      Notes
                      <input className="recipe-input" value={ingredientNotes} onChange={(event) => setIngredientNotes(event.target.value)} placeholder="Optional" />
                    </label>
                    <button className="recipe-button recipe-button-primary" disabled={busy || !ingredientId}>
                      Add ingredient
                    </button>
                  </form>
                )}
              </div>

              <div className="recipe-card">
                <div className="recipe-section-heading">
                  <div>
                    <h3>Sub-recipes</h3>
                    <p>Use a specific previously published preparation version.</p>
                  </div>
                  <span className="recipe-count">{selectedVersion.subrecipeLines.length} lines</span>
                </div>

                {selectedVersion.subrecipeLines.length === 0 ? (
                  <p className="recipe-muted">No sub-recipes added.</p>
                ) : (
                  <div className="recipe-line-list">
                    {selectedVersion.subrecipeLines.map((line) => (
                      <div className="recipe-line" key={line.id}>
                        <div>
                          <strong>{line.componentRecipeNameSnapshot}</strong>
                          <small>{line.componentRecipeCodeSnapshot} · v{line.componentVersionNumberSnapshot}</small>
                        </div>
                        <strong className="recipe-quantity">
                          {line.quantity} {line.componentOutputUnitSymbolSnapshot}
                        </strong>
                        {editable && (
                          <button className="recipe-icon-button" title="Remove sub-recipe" disabled={busy} onClick={() => void handleRemoveSubrecipe(line.id)}>
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {editable && (
                  <form className="recipe-inline-form" onSubmit={handleAddSubrecipe}>
                    <label>
                      Recipe
                      <select
                        className="recipe-input"
                        value={candidateRecipeId}
                        onChange={(event) => void handleCandidateRecipeChange(event.target.value)}
                      >
                        <option value="">Select another recipe</option>
                        {recipes.filter((recipe) => recipe.id !== selectedRecipe.id).map((recipe) => (
                          <option key={recipe.id} value={recipe.id}>{recipe.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Published version
                      <select className="recipe-input" required value={candidateVersionId} onChange={(event) => setCandidateVersionId(event.target.value)}>
                        <option value="">Select version</option>
                        {candidateVersions.map((version) => (
                          <option key={version.id} value={version.id}>
                            v{version.versionNumber} · {statusLabel(version.status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Required quantity
                      <input className="recipe-input" required inputMode="decimal" value={subrecipeQuantity} onChange={(event) => setSubrecipeQuantity(event.target.value)} placeholder="Measured amount" />
                    </label>
                    <label>
                      Notes
                      <input className="recipe-input" value={subrecipeNotes} onChange={(event) => setSubrecipeNotes(event.target.value)} placeholder="Optional" />
                    </label>
                    <button className="recipe-button recipe-button-primary" disabled={busy || !candidateVersionId}>
                      Add sub-recipe
                    </button>
                  </form>
                )}
              </div>

              <div className="recipe-card">
                <div className="recipe-section-heading">
                  <div>
                    <h3>Preparation steps</h3>
                    <p>Record the actual kitchen process and optional timers.</p>
                  </div>
                  <span className="recipe-count">{selectedVersion.steps.length} steps</span>
                </div>

                {steps.length === 0 && <p className="recipe-muted">No preparation steps added.</p>}

                <div className="recipe-steps">
                  {steps.map((step, index) => (
                    <div className="recipe-step" key={`${selectedVersion.id}-${step.stepNumber}`}>
                      <div className="recipe-step-number">{step.stepNumber}</div>
                      <div className="recipe-step-fields">
                        <label>
                          Step title
                          <input className="recipe-input" disabled={!editable} value={step.title} onChange={(event) => updateStep(index, "title", event.target.value)} placeholder="Optional title" />
                        </label>
                        <label>
                          Instruction
                          <textarea className="recipe-input" rows={2} disabled={!editable} required value={step.instruction} onChange={(event) => updateStep(index, "instruction", event.target.value)} placeholder="Describe the preparation step." />
                        </label>
                        <label>
                          Timer (seconds)
                          <input className="recipe-input" type="number" min="0" max="86400" disabled={!editable} value={step.timerSeconds} onChange={(event) => updateStep(index, "timerSeconds", event.target.value)} placeholder="Optional" />
                        </label>
                      </div>
                      {editable && (
                        <button className="recipe-icon-button" disabled={busy} onClick={() => removeStep(index)}>
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {editable && (
                  <div className="recipe-form-actions recipe-step-actions">
                    <button className="recipe-button recipe-button-quiet" disabled={busy || steps.length >= 100} onClick={addStep}>
                      + Add step
                    </button>
                    <button className="recipe-button recipe-button-secondary" disabled={busy} onClick={() => void handleSaveSteps()}>
                      Save preparation steps
                    </button>
                  </div>
                )}
              </div>

              {editable && (
                <div className="recipe-publish-panel">
                  <div>
                    <strong>Ready to publish?</strong>
                    <p>Publishing locks this version. Future changes must be made in a new version.</p>
                  </div>
                  <button className="recipe-button recipe-button-publish" disabled={busy} onClick={() => void handlePublish()}>
                    Publish version
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}