import MinhaAssinaturaEmailComponent from "@/components/email/MinhaAssinaturaEmail";

export default function MinhaAssinaturaEmail({ embedded = false }: { embedded?: boolean }) {
  return <MinhaAssinaturaEmailComponent embedded={embedded} />;
}
