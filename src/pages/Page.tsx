import { IonButtons, IonContent, IonHeader, IonMenuButton, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { useParams } from 'react-router';
import ExploreContainer from '../components/ExploreContainer';
import './Page.css';
import { text } from 'ionicons/icons';

const Page: React.FC = () => {
  // nombre  serviprox
 var text  = 'Serviprox';

  const { name } = useParams<{ name: string; }>();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar >
          <IonButtons slot="start">
            <IonMenuButton menu="main-menu" />
          </IonButtons>
          
          <IonTitle color={'primary'}>
            <h1>{text}</h1>
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen  >
        <IonHeader collapse="condense" >
          <IonToolbar >
           
            <IonTitle size="large" >{text}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <ExploreContainer name={name} />
      </IonContent>
    </IonPage>
  );
};

export default Page;
