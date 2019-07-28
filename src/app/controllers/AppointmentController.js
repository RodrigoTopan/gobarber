import * as Yup from 'yup'
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns'
import pt from 'date-fns/locale/pt'
import Appointment from '../models/Appointment';
import User from '../models/User';
import File from '../models/File';
import Notification from '../schemas/Notification';

import CancellationMail from '../jobs/cancellationMail' 
import Queue from '../../lib/Queue'


class AppointmentController {
    async index(req,res){
        const { page = 1 } = req.query;
        const appointments = await Appointment.findAll({
            where: {
                user_id: req.userId,
                canceled_at: null
            },
            attributes: ['id', 'date'],
            limit: 20,
            offset: (page - 1) * 20,
            order: ['date'],
            include: [
                {
                    model: User,
                    as: 'provider',
                    attributes: [ 'id', 'name'],
                    include: [
                        {
                            model: File,
                            as: 'avatar',
                            attributes: ['id', 'path', 'url']
                        }
                    ]
                }
            ]
        })

        return res.status(200).json(appointments)
    }
    async store(req,res){
        const schema = Yup.object().shape({
            date: Yup.date().required(),
            provider_id: Yup.number().required()
        })

        if(!(await schema.isValid(req.body))){
            return res.status(400).json({erro: 'Validation fails'})
        }

        const {provider_id, date} = req.body
        

        /**
         * Check if a provider_id is a provider
         */
    
        const checkIsProvider = await User.findOne({ 
            where: {
                id: provider_id,
                provider: true
            }  
        })

        if(!checkIsProvider){
            return res
                .status(401)
                .json({error: 'You can only create appointments with providers'})
        }

        /**
         * Check if provider is not creating an appointment to himself
         */

        const checkIsProviderTheClient = (provider_id === req.userId)
        
        if(checkIsProviderTheClient) {
            return res
                .status(401)
                .json({error: 'Providers cannot create appointments to themselves'})
        }

        const hourStart = startOfHour(parseISO(date))
        
        if(isBefore(hourStart, new Date())){
            return res.status(400).json({ error: 'Past dates are not permmited'})
        } 

        /**
         * Check date availability
         */
        const checkAvailability = await Appointment.findOne({
            where: {
                provider_id,
                canceled_at: null,
                date: hourStart
            }
        })

        if(checkAvailability){
            return res
                .status(400)
                .json({ error: 'Appointment date is not available'})
        }


        const appointment = await Appointment.create({
            user_id: req.userId,
            provider_id: provider_id,
            date
        })

        /**
         * Notify appointment provider
         */

        const user = await User.findByPk(req.userId)
        const formattedDate = format(
            hourStart,
            "'dia' dd 'de' MMM', às' H:mm'h'",
            {locale: pt}
        )

        const notification = await Notification.create({
            content: `Novo agendamente de ${user.name} para dia ${formattedDate}`,
            user: provider_id
        })


        return res.status(200).json({ appointment, notification })
    }

    async delete(req,res){
        try{
            const appointment = await Appointment.findByPk(req.params.id, {
                include: [
                    {
                        model: User,
                        as: 'provider',
                        attributes: ['name', 'email']
                    },
                    {
                        model: User,
                        as: 'user',
                        attributes: ['name']
                    }
                ]
            })

            if(!appointment && appointment.user_id !== req.userId){
                return res.status(401).json({
                    error: "You don't have permission to cancel this appointment."
                })
            }

            /**
             * Verify if the cancel request is two hours before now
             */
            const dateWithSub = subHours(appointment.date, 2)

            if(isBefore(dateWithSub, new Date())){
                return res.status(401).json({
                    error: 'You can only cancel appointments two hours in advance.'
                })
            }

            appointment.canceled_at = new Date()

            await appointment.save()
            
            
            await Queue.add(CancellationMail.key, {
                appointment
            })

            return res.status(200).json(appointment)
        }catch(error){
            console.log(error.message)
        }
    }
}
export default new AppointmentController()