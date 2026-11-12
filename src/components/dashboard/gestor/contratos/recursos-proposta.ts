import { Font } from '@react-pdf/renderer';

export type RecursosProposta = {
  fonteRegular: string;
  fonteSemibold: string;
  fonteSerifada: string;
  logo: string;
  logoCapa: string;
};

export function recursosPropostaPadrao(): RecursosProposta {
  const publicBase = import.meta.env?.BASE_URL || '/';
  const base = `${publicBase}propostas/`;
  return {
    fonteRegular: `${base}fontes/OpenSans-Regular.ttf`,
    fonteSemibold: `${base}fontes/OpenSans-Semibold.ttf`,
    fonteSerifada: `${base}fontes/NotoSerif-Regular.ttf`,
    logo: `${base}logo-share.png`,
    logoCapa: `${publicBase}logoshare.branco.png`,
  };
}

let fontesAtuais = '';
export function registrarFontesProposta(recursos: RecursosProposta) {
  const assinatura = JSON.stringify([
    recursos.fonteRegular,
    recursos.fonteSemibold,
    recursos.fonteSerifada,
  ]);
  if (assinatura === fontesAtuais) return;
  Font.register({
    family: 'PropostaSans',
    fonts: [
      { src: recursos.fonteRegular, fontWeight: 400 },
      { src: recursos.fonteSemibold, fontWeight: 600 },
    ],
  });
  Font.register({ family: 'PropostaSerif', src: recursos.fonteSerifada });
  fontesAtuais = assinatura;
}
