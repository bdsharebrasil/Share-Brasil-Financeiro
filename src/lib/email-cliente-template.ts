/** HTML independente de React. Pode ser utilizado pelo backend ou pela prévia. */
export type EmailClienteTemplate = {
  empresa: string;
  assunto: string;
  mensagem: string;
  preheader?: string;
  assinatura?: string;
  rodape?: string;
  cta?: { texto: string; url: string };
};

const fonte = "Arial, Helvetica, sans-serif";

/** Todo conteúdo dinâmico é texto, nunca HTML confiável. */
export function escaparHtml(valor: string): string {
  return valor.replace(/[&<>"']/g, (caractere) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[caractere]!));
}

function textoHtml(texto: string): string {
  return escaparHtml(texto.trim()).replace(/\r\n?/g, "\n").replace(/\n/g, "<br />");
}

function urlSegura(valor: string): string {
  const url = new URL(valor);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("O endereço do botão deve ser uma URL HTTPS sem credenciais.");
  }
  return escaparHtml(url.href);
}

/**
 * Enviar como corpo HTML, acompanhado de uma alternativa text/plain.
 * CSS exclusivamente inline. Sem dependência de Tailwind, fontes externas ou JS.
 * Outlook clássico recebe uma tabela condicional de 640 px e CTA em VML.
 */
export function gerarEmailClienteHtml(dados: EmailClienteTemplate): string {
  const empresa = escaparHtml(dados.empresa);
  const assunto = escaparHtml(dados.assunto);
  const preheader = escaparHtml((dados.preheader ?? dados.mensagem).replace(/\s+/g, " ").trim().slice(0, 150));
  const cta = dados.cta && dados.cta.texto.trim()
    ? { texto: escaparHtml(dados.cta.texto), url: urlSegura(dados.cta.url) }
    : null;

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <title>${assunto}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;width:100%;background-color:#f8f9fa;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;color:#f8f9fa;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f8f9fa" style="width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;background-color:#f8f9fa;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <!--[if mso]><table role="presentation" width="640" align="center" border="0" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
        <table role="presentation" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:640px;table-layout:fixed;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;background-color:#ffffff;border:1px solid #e2e6eb;">
          <tr>
            <td height="4" bgcolor="#24364b" style="height:4px;font-size:0;line-height:4px;background-color:#24364b;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:30px 30px 24px;border-bottom:1px solid #e8ebef;font-family:${fonte};color:#24364b;word-wrap:break-word;overflow-wrap:anywhere;word-break:break-word;">
              <p style="margin:0;font-family:${fonte};font-size:21px;line-height:28px;font-weight:700;color:#24364b;">${empresa}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 30px 36px;font-family:${fonte};word-wrap:break-word;overflow-wrap:anywhere;word-break:break-word;">
              <h1 style="margin:0 0 24px;font-family:${fonte};font-size:24px;line-height:32px;font-weight:700;color:#202a37;">${assunto}</h1>
              <p style="margin:0;font-family:${fonte};font-size:16px;line-height:26px;mso-line-height-rule:at-least;color:#414c5a;">${textoHtml(dados.mensagem)}</p>
              ${cta ? `
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
                <tr><td height="28" style="height:28px;font-size:0;line-height:28px;">&nbsp;</td></tr>
                <tr><td align="left" style="font-family:${fonte};">
                  <!--[if mso]>
                  <v:roundrect href="${cta.url}" style="height:48px;v-text-anchor:middle;width:250px;" arcsize="12%" stroke="f" fillcolor="#24364b">
                    <w:anchorlock />
                    <center style="font-family:${fonte};font-size:14px;font-weight:bold;color:#ffffff;">${cta.texto}</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="${cta.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;max-width:100%;box-sizing:border-box;background-color:#24364b;border:1px solid #24364b;border-radius:6px;padding:14px 24px;font-family:${fonte};font-size:14px;line-height:20px;font-weight:700;text-align:center;text-decoration:none;color:#ffffff;word-wrap:break-word;overflow-wrap:anywhere;">${cta.texto}</a>
                  <!--<![endif]-->
                </td></tr>
              </table>` : ""}
              ${dados.assinatura?.trim() ? `<p style="margin:32px 0 0;padding:24px 0 0;border-top:1px solid #e8ebef;font-family:${fonte};font-size:14px;line-height:23px;color:#596575;">${textoHtml(dados.assinatura)}</p>` : ""}
            </td>
          </tr>
          ${dados.rodape?.trim() ? `<tr><td bgcolor="#f4f6f8" style="padding:22px 30px;border-top:1px solid #e8ebef;background-color:#f4f6f8;font-family:${fonte};font-size:12px;line-height:19px;color:#637083;word-wrap:break-word;overflow-wrap:anywhere;word-break:break-word;">${textoHtml(dados.rodape)}</td></tr>` : ""}
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function gerarEmailClienteTexto(dados: EmailClienteTemplate): string {
  return [
    dados.empresa.trim(), dados.assunto.trim(), dados.mensagem.trim(),
    dados.cta?.texto.trim() ? `${dados.cta.texto.trim()}: ${dados.cta.url}` : "",
    dados.assinatura?.trim(), dados.rodape?.trim(),
  ].filter(Boolean).join("\n\n");
}
