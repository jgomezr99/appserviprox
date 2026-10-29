import { IonButtons, IonContent, IonHeader, IonMenuButton, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { useParams } from 'react-router';
import ExploreContainer from '../components/ExploreContainer';
import './Page.css';

const Page: React.FC = () => {
  // nombre serviprox
  const appTitle = 'Serviprox';

  const { name } = useParams<{ name: string; }>();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar >
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          
          <IonTitle color={'primary'}>
            <h1>{appTitle}</h1>
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen  >
        <IonHeader collapse="condense" >
          <IonToolbar >
           
            <IonTitle size="large" >{appTitle}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <ExploreContainer name={name} />
      </IonContent>
    </IonPage>
  );
};

export default Page;
