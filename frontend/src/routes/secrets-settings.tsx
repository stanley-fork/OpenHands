import { useQueryClient } from "@tanstack/react-query";
import React from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useGetSecrets } from "#/hooks/query/use-get-secrets";
import { useDeleteSecret } from "#/hooks/mutation/use-delete-secret";
import { SecretForm } from "#/components/features/settings/secrets-settings/secret-form";
import {
  SecretListItem,
  SecretListItemSkeleton,
} from "#/components/features/settings/secrets-settings/secret-list-item";
import { BrandButton } from "#/components/features/settings/brand-button";
import { ConfirmationModal } from "#/components/shared/modals/confirmation-modal";
import { GetSecretsResponse } from "#/api/secrets-service.types";
import { useUserProviders } from "#/hooks/use-user-providers";
import { I18nKey } from "#/i18n/declaration";
import { useConfig } from "#/hooks/query/use-config";

function SecretsSettingsScreen() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data: config } = useConfig();
  const { data: secrets, isLoading: isLoadingSecrets } = useGetSecrets();
  const { mutate: deleteSecret } = useDeleteSecret();
  const { providers } = useUserProviders();

  const isSaas = config?.APP_MODE === "saas";
  const hasProviderSet = providers.length > 0;

  const [view, setView] = React.useState<
    "list" | "add-secret-form" | "edit-secret-form"
  >("list");
  const [selectedSecret, setSelectedSecret] = React.useState<string | null>(
    null,
  );
  const [confirmationModalIsVisible, setConfirmationModalIsVisible] =
    React.useState(false);

  const deleteSecretOptimistically = (secret: string) => {
    queryClient.setQueryData<GetSecretsResponse["custom_secrets"]>(
      ["secrets"],
      (oldSecrets) => {
        if (!oldSecrets) return [];
        return oldSecrets.filter((s) => s.name !== secret);
      },
    );
  };

  const revertOptimisticUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["secrets"] });
  };

  const handleDeleteSecret = (secret: string) => {
    deleteSecretOptimistically(secret);
    deleteSecret(secret, {
      onSettled: () => {
        setConfirmationModalIsVisible(false);
      },
      onError: revertOptimisticUpdate,
    });
  };

  const onConfirmDeleteSecret = () => {
    if (selectedSecret) handleDeleteSecret(selectedSecret);
  };

  const onCancelDeleteSecret = () => {
    setConfirmationModalIsVisible(false);
  };

  const shouldRenderConnectToGitButton = isSaas && !hasProviderSet;

  return (
    <div
      data-testid="secrets-settings-screen"
      className="px-11 py-9 flex flex-col gap-5"
    >
      {isLoadingSecrets && view === "list" && (
        <ul>
          <SecretListItemSkeleton />
          <SecretListItemSkeleton />
          <SecretListItemSkeleton />
        </ul>
      )}

      {shouldRenderConnectToGitButton && (
        <Link
          to="/settings/integrations"
          data-testid="connect-git-button"
          type="button"
        >
          <BrandButton type="button" variant="secondary">
            {t(I18nKey.SECRETS$CONNECT_GIT_PROVIDER)}
          </BrandButton>
        </Link>
      )}

      {secrets?.length === 0 && view === "list" && (
        <p data-testid="no-secrets-message">{t("SECRETS$NO_SECRETS_FOUND")}</p>
      )}

      {!shouldRenderConnectToGitButton && view === "list" && (
        <BrandButton
          testId="add-secret-button"
          type="button"
          variant="primary"
          onClick={() => setView("add-secret-form")}
          isDisabled={isLoadingSecrets}
        >
          {t("SECRETS$ADD_NEW_SECRET")}
        </BrandButton>
      )}

      {view === "list" && (
        <div className="border border-tertiary rounded-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-base-tertiary">
              <tr className="flex w-full items-center">
                <th className="w-1/4 text-left p-3 text-sm font-medium">
                  {t(I18nKey.SETTINGS$NAME)}
                </th>
                <th className="w-1/2 text-left p-3 text-sm font-medium">
                  {t(I18nKey.SECRETS$DESCRIPTION)}
                </th>
                <th className="w-1/4 text-right p-3 text-sm font-medium">
                  {t(I18nKey.SETTINGS$ACTIONS)}
                </th>
              </tr>
            </thead>
            <tbody>
              {secrets?.map((secret) => (
                <SecretListItem
                  key={secret.name}
                  title={secret.name}
                  description={secret.description}
                  onEdit={() => {
                    setView("edit-secret-form");
                    setSelectedSecret(secret.name);
                  }}
                  onDelete={() => {
                    setConfirmationModalIsVisible(true);
                    setSelectedSecret(secret.name);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(view === "add-secret-form" || view === "edit-secret-form") && (
        <SecretForm
          mode={view === "add-secret-form" ? "add" : "edit"}
          selectedSecret={selectedSecret}
          onCancel={() => setView("list")}
        />
      )}

      {confirmationModalIsVisible && (
        <ConfirmationModal
          text={t("SECRETS$CONFIRM_DELETE_KEY")}
          onConfirm={onConfirmDeleteSecret}
          onCancel={onCancelDeleteSecret}
        />
      )}
    </div>
  );
}

export default SecretsSettingsScreen;
