// Credenciais do Google (OAuth client tipo "Desktop" + API key do Picker).
// Preenchidas pelo Paulo no Console do projeto quartzo-5eb76.
//
// NOTA: pro fluxo "installed app" (Desktop) o client_secret NÃO é confidencial
// (a própria doc do Google diz isso). Ainda assim, mantemos o arquivo fora do git
// com `git update-index --skip-worktree` ao preencher os valores reais — o git
// guarda só estes placeholders vazios.
//
// project_number = appId do Picker (do projeto quartzo-5eb76 = 407456134162).

export const GOOGLE = {
  clientId: "",
  clientSecret: "",
  apiKey: "",
  projectNumber: "407456134162",
};

export function googleConfigured(): boolean {
  return !!GOOGLE.clientId && !!GOOGLE.apiKey;
}
