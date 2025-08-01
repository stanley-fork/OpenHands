import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createRoutesStub } from "react-router";
import { screen, waitFor, within } from "@testing-library/react";
import {
  createAxiosNotFoundErrorObject,
  renderWithProviders,
} from "test-utils";
import userEvent from "@testing-library/user-event";
import MainApp from "#/routes/root-layout";
import i18n from "#/i18n";
import * as CaptureConsent from "#/utils/handle-capture-consent";
import OpenHands from "#/api/open-hands";
import * as ToastHandlers from "#/utils/custom-toast-handlers";

describe("frontend/routes/_oh", () => {
  const RouteStub = createRoutesStub([{ Component: MainApp, path: "/" }]);

  const { userIsAuthenticatedMock, settingsAreUpToDateMock } = vi.hoisted(
    () => ({
      userIsAuthenticatedMock: vi.fn(),
      settingsAreUpToDateMock: vi.fn(),
    }),
  );

  beforeAll(() => {
    vi.mock("#/utils/user-is-authenticated", () => ({
      userIsAuthenticated: userIsAuthenticatedMock.mockReturnValue(true),
    }));

    vi.mock("#/services/settings", async (importOriginal) => ({
      ...(await importOriginal<typeof import("#/services/settings")>()),
      settingsAreUpToDate: settingsAreUpToDateMock,
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should render", async () => {
    renderWithProviders(<RouteStub />);
    await screen.findByTestId("root-layout");
  });

  it.skip("should render the AI config modal if settings are not up-to-date", async () => {
    settingsAreUpToDateMock.mockReturnValue(false);
    renderWithProviders(<RouteStub />);

    await screen.findByTestId("ai-config-modal");
  });

  it("should not render the AI config modal if the settings are up-to-date", async () => {
    settingsAreUpToDateMock.mockReturnValue(true);
    renderWithProviders(<RouteStub />);

    await waitFor(() => {
      expect(screen.queryByTestId("ai-config-modal")).not.toBeInTheDocument();
    });
  });

  // FIXME: This test fails when it shouldn't be, please investigate
  it.skip("should render and capture the user's consent if oss mode", async () => {
    const user = userEvent.setup();
    const getConfigSpy = vi.spyOn(OpenHands, "getConfig");
    const getSettingsSpy = vi.spyOn(OpenHands, "getSettings");
    const handleCaptureConsentSpy = vi.spyOn(
      CaptureConsent,
      "handleCaptureConsent",
    );

    getConfigSpy.mockResolvedValue({
      APP_MODE: "oss",
      GITHUB_CLIENT_ID: "test-id",
      POSTHOG_CLIENT_KEY: "test-key",
      FEATURE_FLAGS: {
        ENABLE_BILLING: false,
        HIDE_LLM_SETTINGS: false,
        ENABLE_JIRA: false,
        ENABLE_JIRA_DC: false,
        ENABLE_LINEAR: false,
      },
    });

    // @ts-expect-error - We only care about the user_consents_to_analytics field
    getSettingsSpy.mockResolvedValue({
      user_consents_to_analytics: null,
    });

    renderWithProviders(<RouteStub />);

    // The user has not consented to tracking
    const consentForm = await screen.findByTestId("user-capture-consent-form");
    expect(handleCaptureConsentSpy).not.toHaveBeenCalled();

    const submitButton = within(consentForm).getByRole("button", {
      name: /confirm preferences/i,
    });
    await user.click(submitButton);

    // The user has now consented to tracking
    expect(handleCaptureConsentSpy).toHaveBeenCalledWith(true);
    expect(
      screen.queryByTestId("user-capture-consent-form"),
    ).not.toBeInTheDocument();
  });

  it("should not render the user consent form if saas mode", async () => {
    const getConfigSpy = vi.spyOn(OpenHands, "getConfig");
    getConfigSpy.mockResolvedValue({
      APP_MODE: "saas",
      GITHUB_CLIENT_ID: "test-id",
      POSTHOG_CLIENT_KEY: "test-key",
      FEATURE_FLAGS: {
        ENABLE_BILLING: false,
        HIDE_LLM_SETTINGS: false,
        ENABLE_JIRA: false,
        ENABLE_JIRA_DC: false,
        ENABLE_LINEAR: false,
      },
    });

    renderWithProviders(<RouteStub />);

    await waitFor(() => {
      expect(
        screen.queryByTestId("user-capture-consent-form"),
      ).not.toBeInTheDocument();
    });
  });

  // TODO: Likely failing due to how tokens are now handled in context. Move to e2e tests
  it.skip("should render a new project button if a token is set", async () => {
    localStorage.setItem("token", "test-token");
    const { rerender } = renderWithProviders(<RouteStub />);

    await screen.findByTestId("new-project-button");

    localStorage.removeItem("token");
    rerender(<RouteStub />);

    await waitFor(() => {
      expect(
        screen.queryByTestId("new-project-button"),
      ).not.toBeInTheDocument();
    });
  });

  // TODO: Move to e2e tests
  it.skip("should update the i18n language when the language settings change", async () => {
    const changeLanguageSpy = vi.spyOn(i18n, "changeLanguage");
    const { rerender } = renderWithProviders(<RouteStub />);

    // The default language is English
    expect(changeLanguageSpy).toHaveBeenCalledWith("en");

    localStorage.setItem("LANGUAGE", "es");

    rerender(<RouteStub />);
    expect(changeLanguageSpy).toHaveBeenCalledWith("es");

    rerender(<RouteStub />);
    // The language has not changed, so the spy should not have been called again
    expect(changeLanguageSpy).toHaveBeenCalledTimes(2);
  });

  // FIXME: logoutCleanup has been replaced with a hook
  it.skip("should call logoutCleanup after a logout", async () => {
    const user = userEvent.setup();
    localStorage.setItem("ghToken", "test-token");

    // const logoutCleanupSpy = vi.spyOn(LogoutCleanup, "logoutCleanup");
    renderWithProviders(<RouteStub />);

    const userActions = await screen.findByTestId("user-actions");
    const userAvatar = within(userActions).getByTestId("user-avatar");
    await user.click(userAvatar);

    const logout = within(userActions).getByRole("button", { name: /logout/i });
    await user.click(logout);

    // expect(logoutCleanupSpy).toHaveBeenCalled();
    expect(localStorage.getItem("ghToken")).toBeNull();
  });

  it("should render a you're in toast if it is a new user and in saas mode", async () => {
    const getConfigSpy = vi.spyOn(OpenHands, "getConfig");
    const getSettingsSpy = vi.spyOn(OpenHands, "getSettings");
    const displaySuccessToastSpy = vi.spyOn(
      ToastHandlers,
      "displaySuccessToast",
    );

    getConfigSpy.mockResolvedValue({
      APP_MODE: "saas",
      GITHUB_CLIENT_ID: "test-id",
      POSTHOG_CLIENT_KEY: "test-key",
      FEATURE_FLAGS: {
        ENABLE_BILLING: false,
        HIDE_LLM_SETTINGS: false,
        ENABLE_JIRA: false,
        ENABLE_JIRA_DC: false,
        ENABLE_LINEAR: false,
      },
    });

    getSettingsSpy.mockRejectedValue(createAxiosNotFoundErrorObject());

    renderWithProviders(<RouteStub />);

    await waitFor(() => {
      expect(displaySuccessToastSpy).toHaveBeenCalledWith("BILLING$YOURE_IN");
      expect(displaySuccessToastSpy).toHaveBeenCalledOnce();
    });
  });
});
