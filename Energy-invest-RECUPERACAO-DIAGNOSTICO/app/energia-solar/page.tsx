import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Headphones, MapPin, ShieldCheck, Sun, Zap } from "lucide-react";

import { demoProjects } from "@/lib/projects";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Projetos de Energia Solar | EnergyInvest",
  description:
    "Conheça os projetos de energia solar disponíveis na EnergyInvest, compare valores e escolha sua participação.",
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}


export default function EnergiaSolarPage() {
  const national = demoProjects.filter((project) => !project.international);
  const international = demoProjects.filter((project) => project.international);

  const renderCard = (project: (typeof demoProjects)[number]) => {
    const href = "/cadastro";
    const external = false;

    return (
      <article className={styles.card} key={project.id}>
        <div className={styles.image}>
          <Image
            src={project.image}
            fill
            sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw"
            alt={project.name}
          />
          <span className={styles.location}>
            <MapPin size={13} />
            {project.city}, {project.state}
          </span>
        </div>

        <div className={styles.cardBody}>
          <span className={styles.tag}>
            {project.international ? "PROJETO INTERNACIONAL" : "PROJETO NACIONAL"}
          </span>
          <h3>{project.name}</h3>
          <p>{project.description}</p>

          <div className={styles.metrics}>
            <div>
              <span>Valor da participação</span>
              <strong>{money(project.investmentAmount)}</strong>
            </div>
            <div>
              <span>Período</span>
              <strong>{project.durationDays} dias</strong>
            </div>
          </div>

          <a
            href={href}
            className={styles.buy}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            Escolher este projeto
            <ArrowRight size={17} />
          </a>
        </div>
      </article>
    );
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.shell}>
          <Link href="/" className={styles.brand}>
            <Image src="/logo.png" width={150} height={42} alt="EnergyInvest" priority />
          </Link>

          <nav className={styles.nav}>
            <a href="#projetos">Projetos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#seguranca">Segurança</a>
          </nav>

          <Link href="/login" className={styles.login}>
            Entrar
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={`${styles.shell} ${styles.heroGrid}`}>
          <div>
            <span className={styles.eyebrow}>
              <Sun size={16} /> ENERGIA SOLAR
            </span>
            <h1>Escolha seu projeto solar.</h1>
            <p>
              Compare as opções disponíveis, veja o valor de cada participação
              e escolha o projeto que faz sentido para você.
            </p>

            <div className={styles.heroActions}>
              <a href="#projetos" className={styles.primary}>
                Ver projetos <ArrowRight size={18} />
              </a>
              <a href="#como-funciona" className={styles.secondary}>
                Como funciona
              </a>
            </div>

            <div className={styles.trust}>
              <span><CheckCircle2 size={15} /> Informações claras</span>
              <span><ShieldCheck size={15} /> Checkout seguro</span>
              <span><Headphones size={15} /> Suporte</span>
            </div>
          </div>

          <div className={styles.heroImage}>
            <Image
              src="/solar-12.png"
              fill
              sizes="(max-width: 900px) 100vw, 48vw"
              alt="Projeto solar EnergyInvest"
              priority
            />
            <div className={styles.overlay} />
            <div className={styles.priceBox}>
              <span>Projetos a partir de</span>
              <strong>
                {money(Math.min(...demoProjects.map((p) => p.investmentAmount)))}
              </strong>
              <small>Consulte as condições de cada opção.</small>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.features}>
        <div className={`${styles.shell} ${styles.featureGrid}`}>
          <div><Sun size={21} /><strong>{demoProjects.length} projetos</strong><span>Diferentes faixas de valor.</span></div>
          <div><MapPin size={21} /><strong>Brasil e exterior</strong><span>Opções nacionais e internacionais.</span></div>
          <div><Zap size={21} /><strong>Processo digital</strong><span>Escolha e acompanhe online.</span></div>
        </div>
      </section>

      <section id="projetos" className={styles.catalog}>
        <div className={styles.shell}>
          <div className={styles.heading}>
            <span>CATÁLOGO</span>
            <h2>Projetos disponíveis</h2>
            <p>
              Selecione uma opção para seguir para o checkout ou criar sua conta.
            </p>
          </div>

          <div className={styles.groupTitle}>
            <div><span>NACIONAIS</span><h3>Projetos no Brasil</h3></div>
            <small>{national.length} opções</small>
          </div>
          <div className={styles.grid}>{national.map(renderCard)}</div>

          <div className={styles.groupTitle}>
            <div><span>INTERNACIONAIS</span><h3>Projetos fora do Brasil</h3></div>
            <small>{international.length} opções</small>
          </div>
          <div className={styles.grid}>{international.map(renderCard)}</div>
        </div>
      </section>

      <section id="como-funciona" className={styles.how}>
        <div className={styles.shell}>
          <div className={styles.heading}>
            <span>PASSO A PASSO</span>
            <h2>Como funciona</h2>
          </div>

          <div className={styles.steps}>
            {[
              ["01", "Escolha o projeto", "Compare as opções e selecione a desejada."],
              ["02", "Revise as informações", "Confira valor, localização e condições."],
              ["03", "Finalize no checkout", "O pagamento é processado em ambiente seguro."],
              ["04", "Acompanhe sua conta", "Após a confirmação, acompanhe tudo pela plataforma."],
            ].map(([n, title, text]) => (
              <div className={styles.step} key={n}>
                <span>{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="seguranca" className={styles.security}>
        <div className={`${styles.shell} ${styles.securityGrid}`}>
          <div>
            <span className={styles.eyebrow}>
              <ShieldCheck size={16} /> TRANSPARÊNCIA
            </span>
            <h2>Informação antes da decisão.</h2>
            <p>
              Confira o valor e as características do projeto antes de concluir
              a contratação. Leia as condições apresentadas na plataforma e no checkout.
            </p>
          </div>

          <div className={styles.securityBox}>
            <ShieldCheck size={25} />
            <strong>Pagamento protegido</strong>
            <span>O checkout é processado pelo provedor de pagamento integrado à plataforma.</span>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.shell}>
          <div className={styles.footerTop}>
            <Image src="/logo.png" width={138} height={40} alt="EnergyInvest" />
            <div>
              <strong>Suporte</strong>
              <a href="mailto:energyinvest3@gmail.com">energyinvest3@gmail.com</a>
              <a href="https://wa.me/5511977692699" target="_blank" rel="noopener noreferrer">
                WhatsApp: +55 11 97769-2699
              </a>
            </div>
          </div>

          <div className={styles.footerLinks}>
            <Link href="/termos">Termos</Link>
            <Link href="/privacidade">Privacidade</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
