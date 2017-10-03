import * as unirest from 'unirest';

import { ISession } from '../ISession';
import { IGrades } from '../IGrades';

export interface IFetchGradesRequest
{
    session: ISession;
    registerId: number;
}

export interface IFetchGradesResponse
{
    grades: IGrades;
}

export function fetchGrades(request: IFetchGradesRequest): Promise<IFetchGradesResponse>
{
    return new Promise<IFetchGradesResponse>((resolve, reject) =>
    {
        unirest.post('https://iuczniowie.progman.pl/idziennik/mod_panelRodzica/oceny/WS_ocenyUcznia.asmx/pobierzOcenyUcznia')
            .headers({
                'Accept': 'application/json, text/javascript, */*',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'pl-PL,pl;q=0.8,en-US;q=0.6,en;q=0.4,de;q=0.2,und;q=0.2',
                'Connection': 'keep-alive',
                'Content-Type': 'application/json; charset=UTF-8',
                'Cookie': `ASP.NET_SessionId_iDziennik=${request.session.sessionId}; Bearer=${request.session.bearerToken}; .ASPXAUTH=${request.session.privateToken}`,
                'Host': 'iuczniowie.progman.pl',
                'Origin': 'https://iuczniowie.progman.pl',
                'Referer': 'https://iuczniowie.progman.pl/idziennik/mod_panelRodzica/Oceny.aspx',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537 (KHTML, like Gecko) Chrome/60 Safari/537',
                'X-Requested-With': 'XMLHttpRequest'
            })
            .redirect(false)
            .jar(false)
            .encoding('UTF-8')
            .send(`{idPozDziennika: ${request.registerId}}`)
            .end(response =>
            {
                if (response.error)
                {
                    reject(response.error);
                }
                else
                {
                    if (response.code === 200)
                    {
                        const parsedGrades = parseGrades(response.body.d);

                        resolve({
                            grades: parsedGrades
                        });
                    }
                    else
                    {
                        reject('err_request_not_ok');
                    }
                }
            });

        function parseGrades(rawGrades: any): IGrades
        {
            var parsedGrades: IGrades = {
                semesterCount: rawGrades.IloscSemestrow,
                evaluationType: rawGrades.TypOceniania,
                isGpaWeighted: rawGrades.WarSredniaOcen,
                selectedSemester: rawGrades.WybranySemestr,

                subjects: []
            };

            rawGrades.Przedmioty.forEach(Przedmiot =>
            {
                let parsedSubject = {
                    id: Przedmiot.IdPrzedmiotu,
                    name: Przedmiot.Przedmiot,

                    yearGpa: Przedmiot.SrednieCaloroczne.split(' / ')[0],
                    semestersGpa: {} as any,
                    semesters: {} as any
                };

                for (let i = 1; i <= Przedmiot.SrednieWSemestrach.length; i++)
                {
                    parsedSubject.semestersGpa[i] = Przedmiot.SrednieWSemestrach[i - 1].split(' / ')[0];
                }

                for (let i = 1; i <= parsedGrades.semesterCount; i++)
                {
                    parsedSubject.semesters[i] = [];
                }

                Przedmiot.Oceny.forEach(Ocena =>
                {
                    let parsedGrade = {
                        issuedDate: Date.parse(Ocena.Data_wystaw),
                        issuedBy: Ocena.Wystawil,
                        countsForGpa: Ocena.DoSredniej,
                        history: [],
                        category: Ocena.Kategoria,
                        color: Ocena.Kolor,
                        grade: Ocena.Ocena,
                        semester: Ocena.Semestr,
                        type: Ocena.Typ,
                        weight: Ocena.Waga,
                        valueForGpa: Ocena.WartoscDoSred,
                        idK: Ocena.idK,
                    };

                    Ocena.Historia.forEach(HistoriaOcena =>
                    {
                        let parsedGradeHistory = {
                            issuedDate: Date.parse(HistoriaOcena.Data_wystaw),
                            countsForGpa: HistoriaOcena.DoSredniej,
                            category: HistoriaOcena.Kategoria,
                            color: HistoriaOcena.Kolor,
                            grade: HistoriaOcena.Ocena,
                            semester: HistoriaOcena.Semestr,
                            reason: HistoriaOcena.Uzasadnienie,
                            weight: HistoriaOcena.Waga,
                            valueForGpa: HistoriaOcena.WartoscDoSred
                        };

                        parsedGrade.history.push(parsedGradeHistory);
                    });


                    parsedSubject.semesters[Ocena.Semestr].push(parsedGrade);
                });

                parsedGrades.subjects.push(parsedSubject);
            });

            return parsedGrades;
        }
    });
}